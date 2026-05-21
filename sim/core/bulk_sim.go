package core

import (
	"cmp"
	"container/heap"
	"fmt"
	"log"
	"math"
	"runtime"
	"slices"
	"sync"
	"time"

	"github.com/wowsims/mop/sim/core/proto"
	"github.com/wowsims/mop/sim/core/simsignals"
	googleProto "google.golang.org/protobuf/proto"
)

const (
	bulkSimDefaultTopResults                      = 5
	bulkSimMinCombinations                        = 20
	bulkSimCullingCoefficient                     = 1.35
	bulkSimLowStageConcurrencyFactor              = 2
	bulkSimCombinationLogMin              float64 = 10
	bulkSimMaxAdaptivePasses                      = 2
	bulkSimAdaptiveMaxIterationMultiplier         = 4
	bulkSimProgressThrottle                       = 100 * time.Millisecond
)

type BulkSimStageConfig struct {
	Stage              proto.BulkSimStage
	MinIterations      int32
	TargetErrorPct     float64
	MinSurvivors       int
	MaxSurvivors       int
	CullingCoefficient float64
	UseConcurrentSim   bool
}

var bulkSimStageConfigs = []BulkSimStageConfig{
	{
		Stage:              proto.BulkSimStage_BulkSimStageLow,
		MinIterations:      100,
		TargetErrorPct:     1,
		MinSurvivors:       20,
		MaxSurvivors:       100,
		CullingCoefficient: bulkSimCullingCoefficient,
	},
	{
		Stage:              proto.BulkSimStage_BulkSimStageMedium,
		MinIterations:      1000,
		TargetErrorPct:     0.2,
		MinSurvivors:       5,
		MaxSurvivors:       25,
		CullingCoefficient: bulkSimCullingCoefficient,
	},
	{
		Stage:            proto.BulkSimStage_BulkSimStageHigh,
		MinIterations:    1000,
		TargetErrorPct:   0.05,
		UseConcurrentSim: true,
	},
}

type BulkSimCandidate struct {
	Index int32
	Gear  *proto.EquipmentSpec
}

type BulkSimStageTask struct {
	Candidate BulkSimCandidate
	Position  int
}

type BulkSimCandidateResult struct {
	Candidate  BulkSimCandidate
	DpsMetrics *proto.DistributionMetrics
	Error      *proto.ErrorOutcome
}

type BulkSimStageResult struct {
	Baseline   *BulkSimCandidateResult
	Results    []*BulkSimCandidateResult
	Iterations int32
	Metrics    *proto.BulkSimStageMetrics
}

type bulkSimResultMinHeap []*BulkSimCandidateResult

func (h bulkSimResultMinHeap) Len() int { return len(h) }

func (h bulkSimResultMinHeap) Less(i, j int) bool {
	return h[i].DpsMetrics.Avg < h[j].DpsMetrics.Avg
}

func (h bulkSimResultMinHeap) Swap(i, j int) { h[i], h[j] = h[j], h[i] }

func (h *bulkSimResultMinHeap) Push(x any) {
	*h = append(*h, x.(*BulkSimCandidateResult))
}

func (h *bulkSimResultMinHeap) Pop() any {
	old := *h
	n := len(old)
	result := old[n-1]
	*h = old[:n-1]
	return result
}

type BulkSimStageProgressTracker struct {
	mutex                               sync.Mutex
	stage                               proto.BulkSimStage
	progress                            chan *proto.ProgressMetrics
	totalCandidates                     int
	totalSims                           int
	iterations                          int32
	totalIterations                     int32
	completedSimsBeforeCandidates       int
	completedIterationsBeforeCandidates int32
	completedCandidates                 int
	completedCandidateIterations        int32
	completedIterationsByCandidate      []int32
	lastProgressEmit                    time.Time
}

func BulkSim(request *proto.BulkSimRequest) *proto.BulkSimResult {
	return runBulkSim(request, nil, simsignals.CreateSignals())
}

func BulkSimAsync(request *proto.BulkSimRequest, progress chan *proto.ProgressMetrics, requestId string) {
	signals, err := simsignals.RegisterWithId(requestId)
	if err != nil {
		progress <- &proto.ProgressMetrics{
			BulkStage: proto.BulkSimStage_BulkSimStageError,
			FinalBulkSimResult: &proto.BulkSimResult{
				Error: &proto.ErrorOutcome{Message: "Couldn't register for signal API: " + err.Error()},
			},
		}
		close(progress)
		return
	}

	go func() {
		defer simsignals.UnregisterId(requestId)
		defer close(progress)

		result := runBulkSim(request, progress, signals)
		if result != nil && result.Error != nil && result.Error.Type == proto.ErrorOutcomeType_ErrorOutcomeAborted {
			log.Printf("[Bulk Sim] Cancelled")
		}
		progress <- &proto.ProgressMetrics{
			BulkStage:          proto.BulkSimStage_BulkSimStageComplete,
			FinalBulkSimResult: result,
		}
	}()
}

func runBulkSim(request *proto.BulkSimRequest, progress chan *proto.ProgressMetrics, signals simsignals.Signals) *proto.BulkSimResult {
	startedAt := time.Now()

	if err := validateBulkSimRequest(request); err != "" {
		return &proto.BulkSimResult{Error: &proto.ErrorOutcome{Message: err}}
	}

	candidates := make([]BulkSimCandidate, 0, len(request.Candidates))
	for _, candidate := range request.Candidates {
		if candidate == nil || candidate.Gear == nil {
			continue
		}
		candidates = append(candidates, BulkSimCandidate{
			Index: candidate.Index,
			Gear:  candidate.Gear,
		})
	}

	topResults := int(request.TopResults)
	if topResults <= 0 {
		topResults = bulkSimDefaultTopResults
	}

	result := &proto.BulkSimResult{
		Timings: &proto.BulkSimTimings{},
	}

	if len(candidates) == 0 {
		baselineResult := runSingleBulkSim(request, BulkSimCandidate{Index: -1, Gear: request.BaselineGear}, request.BaseRequest.SimOptions.Iterations, signals)
		if baselineResult.Error != nil {
			result.Error = baselineResult.Error
			return result
		}
		result.Baseline = bulkSimCandidateResultToProto(baselineResult)
		result.Timings.TotalSeconds = time.Since(startedAt).Seconds()
		result.Timings.SimmingSeconds = result.Timings.TotalSeconds
		return result
	}

	simmingStartedAt := time.Now()
	var latestBaseline *BulkSimCandidateResult
	var latestResults []*BulkSimCandidateResult

	for _, stageConfig := range bulkSimStageConfigs {
		if signals.Abort.IsTriggered() {
			result.Error = bulkSimAbortedError()
			return result
		}

		if !shouldRunBulkSimStage(stageConfig, len(candidates)) {
			continue
		}

		stageResult := runBulkSimStage(request, candidates, stageConfig, progress, signals)
		if stageResult.Baseline != nil && stageResult.Baseline.Error != nil {
			result.Error = stageResult.Baseline.Error
			return result
		}
		for _, candidateResult := range stageResult.Results {
			if candidateResult.Error != nil {
				result.Error = candidateResult.Error
				return result
			}
		}

		latestBaseline = stageResult.Baseline
		latestResults = stageResult.Results
		result.StageMetrics = append(result.StageMetrics, stageResult.Metrics)
		setBulkSimStageTiming(result.Timings, stageConfig.Stage, stageResult.Metrics.DurationSeconds)

		if stageConfig.MaxSurvivors > 0 {
			candidates = selectBulkSimSurvivors(stageResult.Results, stageResult.Baseline, stageResult.Iterations, stageConfig)
			stageResult.Metrics.Survivors = int32(len(candidates))
		}
		log.Printf("[Bulk Sim] %s", formatBulkSimStageSummary("Finished", stageResult.Metrics, len(stageResult.Results)))
	}

	if latestBaseline == nil {
		baselineResult := runSingleBulkSim(request, BulkSimCandidate{Index: -1, Gear: request.BaselineGear}, request.BaseRequest.SimOptions.Iterations, signals)
		if baselineResult.Error != nil {
			result.Error = baselineResult.Error
			return result
		}
		latestBaseline = baselineResult
	}
	if latestResults == nil {
		latestResults = []*BulkSimCandidateResult{}
	}

	result.Baseline = bulkSimCandidateResultToProto(latestBaseline)
	for _, candidateResult := range topBulkSimResults(latestResults, topResults) {
		result.TopResults = append(result.TopResults, bulkSimCandidateResultToProto(candidateResult))
	}

	result.Timings.SimmingSeconds = time.Since(simmingStartedAt).Seconds()
	result.Timings.TotalSeconds = time.Since(startedAt).Seconds()
	return result
}

func validateBulkSimRequest(request *proto.BulkSimRequest) string {
	if request == nil {
		return "[Bulk sim] Request is empty"
	}
	if request.BaseRequest == nil {
		return "[Bulk sim] Base request is empty"
	}
	if request.BaseRequest.Raid == nil {
		return "[Bulk sim] Raid is empty"
	}
	if request.BaseRequest.SimOptions == nil {
		return "[Bulk sim] Sim options are empty"
	}
	if request.BaselineGear == nil {
		return "[Bulk sim] Baseline gear is empty"
	}
	if _, err := getBulkSimPlayer(request.BaseRequest.Raid); err != "" {
		return err
	}
	return ""
}

func shouldRunBulkSimStage(config BulkSimStageConfig, candidateCount int) bool {
	return config.MaxSurvivors == 0 || candidateCount > config.MaxSurvivors || candidateCount < bulkSimMinCombinations && config.Stage == proto.BulkSimStage_BulkSimStageHigh
}

func getBulkSimStageConcurrency(request *proto.BulkSimRequest, config BulkSimStageConfig) int {
	if config.UseConcurrentSim {
		return 1
	}
	if request.BaseRequest.SimOptions.IsTest {
		return 3
	}
	if config.Stage == proto.BulkSimStage_BulkSimStageLow {
		return runtime.NumCPU() * bulkSimLowStageConcurrencyFactor
	}
	return runtime.NumCPU()
}

func runBulkSimStage(request *proto.BulkSimRequest, candidates []BulkSimCandidate, config BulkSimStageConfig, progress chan *proto.ProgressMetrics, signals simsignals.Signals) BulkSimStageResult {
	startedAt := time.Now()
	minIterations := getBulkSimStageMinIterations(request, config)
	concurrency := getBulkSimStageConcurrency(request, config)
	concurrency = max(1, min(concurrency, len(candidates)))
	log.Printf("[Bulk Sim] %s", formatBulkSimStageStart(config, len(candidates), concurrency, minIterations))
	maxBaselineSims := 2
	maxTotalSims := len(candidates) + maxBaselineSims
	probeTotalIterations := int32(maxTotalSims) * minIterations
	emitBulkSimStageProgress(progress, config.Stage, 0, maxTotalSims, 0, probeTotalIterations, 0)

	// Run the baseline gear once at the stage minimum to estimate DPS variance.
	// That variance is used to calculate how many iterations are needed for the
	// stage target error; user-provided high-stage iterations are treated as a
	// floor and may be raised if the probe shows more iterations are required.
	baselineProbe := runSingleBulkSimWithProgress(request, BulkSimCandidate{Index: -1, Gear: request.BaselineGear}, minIterations, signals, config.UseConcurrentSim, func(progressMetrics *proto.ProgressMetrics) {
		if progressMetrics.TotalIterations == 0 {
			return
		}
		emitBulkSimStageProgress(progress, config.Stage, 0, maxTotalSims, min(progressMetrics.CompletedIterations, minIterations), probeTotalIterations, progressMetrics.Dps)
	})
	if baselineProbe.Error != nil {
		return BulkSimStageResult{Baseline: baselineProbe}
	}
	emitBulkSimStageProgress(progress, config.Stage, 1, maxTotalSims, minIterations, probeTotalIterations, baselineProbe.DpsMetrics.Avg)

	iterations := getBulkSimStageIterations(request, config, baselineProbe.DpsMetrics, len(candidates))
	reuseBaselineProbe := iterations == minIterations
	baselineSims := TernaryInt(reuseBaselineProbe, 1, 2)
	totalSims := len(candidates) + baselineSims
	completedBaselineIterations := minIterations
	baseline := baselineProbe

	totalStageIterations := (int32(len(candidates)) + 1) * iterations
	emitBulkSimStageProgress(progress, config.Stage, 1, totalSims, completedBaselineIterations, totalStageIterations, baselineProbe.DpsMetrics.Avg)
	if !reuseBaselineProbe {
		extraBaselineIterations := iterations - minIterations
		baselineExtra := runSingleBulkSimWithProgressAndSeedOffset(request, BulkSimCandidate{Index: -1, Gear: request.BaselineGear}, extraBaselineIterations, minIterations, signals, config.UseConcurrentSim, func(progressMetrics *proto.ProgressMetrics) {
			if progressMetrics.TotalIterations == 0 {
				return
			}
			emitBulkSimStageProgress(progress, config.Stage, 1, totalSims, minIterations+min(progressMetrics.CompletedIterations, extraBaselineIterations), totalStageIterations, progressMetrics.Dps)
		})
		if baselineExtra.Error != nil {
			baseline = baselineExtra
			return BulkSimStageResult{Baseline: baseline, Iterations: iterations}
		}
		baseline = mergeBulkSimCandidateResults(baselineProbe, baselineExtra)
		completedBaselineIterations = iterations
		emitBulkSimStageProgress(progress, config.Stage, baselineSims, totalSims, completedBaselineIterations, totalStageIterations, baseline.DpsMetrics.Avg)
	}

	jobs := make(chan BulkSimStageTask, len(candidates))
	results := make(chan *BulkSimCandidateResult, len(candidates))
	progressTracker := &BulkSimStageProgressTracker{
		stage:                               config.Stage,
		progress:                            progress,
		totalCandidates:                     len(candidates),
		totalSims:                           totalSims,
		iterations:                          iterations,
		totalIterations:                     totalStageIterations,
		completedSimsBeforeCandidates:       baselineSims,
		completedIterationsBeforeCandidates: completedBaselineIterations,
		completedIterationsByCandidate:      make([]int32, len(candidates)),
	}
	var wg sync.WaitGroup

	for i := 0; i < concurrency; i++ {
		wg.Go(func() {
			for task := range jobs {
				if signals.Abort.IsTriggered() {
					return
				}

				candidateResult := runSingleBulkSimWithProgress(request, task.Candidate, iterations, signals, config.UseConcurrentSim, func(progressMetrics *proto.ProgressMetrics) {
					progressTracker.reportCandidateProgress(task.Position, progressMetrics)
				})
				progressTracker.reportCandidateComplete(task.Position, candidateResult)
				results <- candidateResult
			}
		})
	}

	go func() {
		defer close(jobs)
		for idx, candidate := range candidates {
			if signals.Abort.IsTriggered() {
				return
			}
			jobs <- BulkSimStageTask{Candidate: candidate, Position: idx}
		}
	}()

	go func() {
		wg.Wait()
		close(results)
	}()

	collected := make([]*BulkSimCandidateResult, 0, len(candidates))
	for candidateResult := range results {
		collected = append(collected, candidateResult)
		if candidateResult.Error != nil {
			signals.Abort.Trigger()
		}
	}
	baseline, collected, iterations = adaptBulkSimStageIterations(request, candidates, config, progress, signals, concurrency, baseline, collected, iterations)
	if baseline.Error != nil {
		return BulkSimStageResult{Baseline: baseline, Results: collected, Iterations: iterations}
	}

	metrics := &proto.BulkSimStageMetrics{
		Stage:               config.Stage,
		InputGearSets:       int32(len(candidates)),
		Survivors:           int32(len(collected)),
		Iterations:          iterations,
		Concurrency:         int32(concurrency),
		DurationSeconds:     time.Since(startedAt).Seconds(),
		TargetErrorPct:      config.TargetErrorPct,
		ObservedErrorPct:    bulkSimObservedStageErrorPct(baseline, collected, iterations, len(candidates)),
		BaselineAvgDps:      baseline.DpsMetrics.Avg,
		BestCandidateAvgDps: bestBulkSimDps(collected),
	}

	return BulkSimStageResult{
		Baseline:   baseline,
		Results:    collected,
		Iterations: iterations,
		Metrics:    metrics,
	}
}

func runSingleBulkSim(request *proto.BulkSimRequest, candidate BulkSimCandidate, iterations int32, signals simsignals.Signals) *BulkSimCandidateResult {
	return runSingleBulkSimWithProgress(request, candidate, iterations, signals, false, nil)
}

func runSingleBulkSimWithProgress(request *proto.BulkSimRequest, candidate BulkSimCandidate, iterations int32, signals simsignals.Signals, useConcurrentSim bool, progressCallback func(*proto.ProgressMetrics)) *BulkSimCandidateResult {
	return runSingleBulkSimWithProgressAndSeedOffset(request, candidate, iterations, 0, signals, useConcurrentSim, progressCallback)
}

func runSingleBulkSimWithProgressAndSeedOffset(request *proto.BulkSimRequest, candidate BulkSimCandidate, iterations int32, seedOffset int32, signals simsignals.Signals, useConcurrentSim bool, progressCallback func(*proto.ProgressMetrics)) *BulkSimCandidateResult {
	if signals.Abort.IsTriggered() {
		return &BulkSimCandidateResult{Candidate: candidate, Error: bulkSimAbortedError()}
	}

	simRequest := googleProto.Clone(request.BaseRequest).(*proto.RaidSimRequest)
	simRequest.SimOptions.Iterations = iterations
	simRequest.SimOptions.RandomSeed += int64(seedOffset)
	simRequest.SimOptions.DebugFirstIteration = false
	simRequest.SimOptions.Debug = false

	player, err := getBulkSimPlayer(simRequest.Raid)
	if err != "" {
		return &BulkSimCandidateResult{Candidate: candidate, Error: &proto.ErrorOutcome{Message: err}}
	}
	player.Equipment = googleProto.Clone(candidate.Gear).(*proto.EquipmentSpec)

	var simProgress chan *proto.ProgressMetrics
	var progressWg sync.WaitGroup
	if progressCallback != nil && !simRequest.SimOptions.IsTest {
		simProgress = make(chan *proto.ProgressMetrics, 16)
		progressWg.Go(func() {
			for progressMetrics := range simProgress {
				progressCallback(progressMetrics)
			}
		})
	}

	var simResult *proto.RaidSimResult
	if useConcurrentSim {
		simResult = runSimConcurrent(simRequest, simProgress, signals)
	} else {
		simResult = RunSim(simRequest, simProgress, signals)
	}
	if simProgress != nil {
		progressWg.Wait()
	}
	if simResult == nil {
		return &BulkSimCandidateResult{Candidate: candidate, Error: &proto.ErrorOutcome{Message: "Bulk sim did not return a result"}}
	}
	if simResult.Error != nil {
		if simResult.Error.Type == proto.ErrorOutcomeType_ErrorOutcomeAborted && simResult.Error.Message == "" {
			return &BulkSimCandidateResult{Candidate: candidate, Error: bulkSimAbortedError()}
		}
		return &BulkSimCandidateResult{Candidate: candidate, Error: simResult.Error}
	}

	return &BulkSimCandidateResult{
		Candidate:  candidate,
		DpsMetrics: cleanBulkSimDpsMetrics(simResult.RaidMetrics.Dps),
	}
}

func getBulkSimPlayer(raid *proto.Raid) (*proto.Player, string) {
	if raid == nil {
		return nil, "[Bulk Sim] Raid is empty"
	}
	if len(raid.Parties) == 0 || raid.Parties[0] == nil || len(raid.Parties[0].Players) == 0 {
		return nil, "[Bulk Sim] First party has no players"
	}

	player := raid.Parties[0].Players[0]
	if player == nil || player.Class == proto.Class_ClassUnknown {
		return nil, "[Bulk Sim] First player is empty"
	}

	return player, ""
}

func getBulkSimStageMinIterations(request *proto.BulkSimRequest, config BulkSimStageConfig) int32 {
	if usesUserDefinedHighStageIterations(request, config) {
		return request.HighStageIterations
	}
	return config.MinIterations
}

func getBulkSimStageIterations(request *proto.BulkSimRequest, config BulkSimStageConfig, baselineMetrics *proto.DistributionMetrics, candidateCount int) int32 {
	minIterations := getBulkSimStageMinIterations(request, config)
	// The user-defined high-stage iteration count is a floor, not a cap. Every
	// stage still uses enough iterations to satisfy its target error when needed.
	targetIterations := getBulkSimTargetIterations(config.TargetErrorPct, baselineMetrics, candidateCount)
	return max(minIterations, targetIterations)
}

func getBulkSimTargetIterations(targetErrorPct float64, metrics *proto.DistributionMetrics, candidateCount int) int32 {
	if metrics == nil || metrics.Avg <= 0 {
		return 0
	}

	targetError := metrics.Avg * (targetErrorPct / 100)
	if targetError <= 0 {
		return 0
	}

	combinationMultiplier := bulkSimCombinationErrorMultiplier(candidateCount)
	return int32(math.Ceil(math.Pow((metrics.Stdev*combinationMultiplier)/targetError, 2)))
}

func usesUserDefinedHighStageIterations(request *proto.BulkSimRequest, config BulkSimStageConfig) bool {
	return config.Stage == proto.BulkSimStage_BulkSimStageHigh && request.HighStageIterations > 0
}

func selectBulkSimSurvivors(results []*BulkSimCandidateResult, baseline *BulkSimCandidateResult, iterations int32, config BulkSimStageConfig) []BulkSimCandidate {
	if config.MaxSurvivors == 0 || len(results) <= config.MaxSurvivors {
		return bulkSimResultsToCandidates(results)
	}

	bestMetrics := baseline.DpsMetrics
	maxActorError := bulkSimDpsError(baseline.DpsMetrics, iterations)
	for _, result := range results {
		if result.DpsMetrics.Avg > bestMetrics.Avg {
			bestMetrics = result.DpsMetrics
		}
		maxActorError = math.Max(maxActorError, bulkSimDpsError(result.DpsMetrics, iterations))
	}
	lowerBound := bestMetrics.Avg - maxActorError*config.CullingCoefficient

	meanSurvivors := topBulkSimResults(results, config.MinSurvivors)
	survivors := make([]*BulkSimCandidateResult, 0, config.MaxSurvivors)
	seen := make(map[int32]bool)
	for _, result := range meanSurvivors {
		survivors = append(survivors, result)
		seen[result.Candidate.Index] = true
	}
	for _, result := range results {
		if result.DpsMetrics.Avg < lowerBound || seen[result.Candidate.Index] {
			continue
		}
		survivors = append(survivors, result)
		seen[result.Candidate.Index] = true
	}
	if len(survivors) > config.MaxSurvivors {
		survivors = topBulkSimResults(survivors, config.MaxSurvivors)
	}

	return bulkSimResultsToCandidates(survivors)
}

func bulkSimDpsError(metrics *proto.DistributionMetrics, iterations int32) float64 {
	if metrics == nil || iterations <= 0 {
		return 0
	}
	return metrics.Stdev / math.Sqrt(float64(iterations))
}

func bulkSimCombinationErrorMultiplier(candidateCount int) float64 {
	return math.Sqrt(math.Max(1, math.Log10(math.Max(float64(candidateCount), bulkSimCombinationLogMin))))
}

func bulkSimObservedErrorPct(metrics *proto.DistributionMetrics, iterations int32, candidateCount int) float64 {
	if metrics == nil || metrics.Avg <= 0 || iterations <= 0 {
		return 0
	}
	return bulkSimDpsError(metrics, iterations) * bulkSimCombinationErrorMultiplier(candidateCount) / metrics.Avg * 100
}

func bulkSimObservedStageErrorPct(baseline *BulkSimCandidateResult, results []*BulkSimCandidateResult, iterations int32, candidateCount int) float64 {
	observedErrorPct := 0.0
	if baseline != nil {
		observedErrorPct = bulkSimObservedErrorPct(baseline.DpsMetrics, iterations, candidateCount)
	}
	for _, result := range results {
		if result == nil {
			continue
		}
		observedErrorPct = math.Max(observedErrorPct, bulkSimObservedErrorPct(result.DpsMetrics, iterations, candidateCount))
	}
	return observedErrorPct
}

func getBulkSimStageTargetIterations(targetErrorPct float64, baseline *BulkSimCandidateResult, results []*BulkSimCandidateResult, candidateCount int) int32 {
	targetIterations := int32(0)
	if baseline != nil {
		targetIterations = max(targetIterations, getBulkSimTargetIterations(targetErrorPct, baseline.DpsMetrics, candidateCount))
	}
	for _, result := range results {
		if result == nil {
			continue
		}
		targetIterations = max(targetIterations, getBulkSimTargetIterations(targetErrorPct, result.DpsMetrics, candidateCount))
	}
	return targetIterations
}

func adaptBulkSimStageIterations(request *proto.BulkSimRequest, candidates []BulkSimCandidate, config BulkSimStageConfig, progress chan *proto.ProgressMetrics, signals simsignals.Signals, concurrency int, baseline *BulkSimCandidateResult, results []*BulkSimCandidateResult, iterations int32) (*BulkSimCandidateResult, []*BulkSimCandidateResult, int32) {
	maxAdaptiveIterations := int32(math.Ceil(float64(iterations) * bulkSimAdaptiveMaxIterationMultiplier))
	for adaptivePass := 1; adaptivePass <= bulkSimMaxAdaptivePasses; adaptivePass++ {
		if signals.Abort.IsTriggered() || hasBulkSimStageError(baseline, results) {
			return baseline, results, iterations
		}

		observedErrorPct := bulkSimObservedStageErrorPct(baseline, results, iterations, len(candidates))
		if observedErrorPct <= config.TargetErrorPct {
			return baseline, results, iterations
		}

		targetIterations := getBulkSimStageTargetIterations(config.TargetErrorPct, baseline, results, len(candidates))
		targetIterations = min(maxAdaptiveIterations, max(iterations+1, targetIterations))
		if targetIterations <= iterations {
			return baseline, results, iterations
		}

		additionalIterations := targetIterations - iterations
		log.Printf("[Bulk Sim] - Stage: %s - Adaptive pass %d\nResults:\n  Current iterations: %d\n  Additional iterations: %d\n  Target iterations: %d\n  Target error: %.2f%%\n  Observed error: %.2f%%", bulkSimStageLogName(config.Stage), adaptivePass, iterations, additionalIterations, targetIterations, config.TargetErrorPct, observedErrorPct)
		baseline, results = rerunBulkSimStageAdditionalIterations(request, candidates, config, progress, signals, concurrency, baseline, results, iterations, additionalIterations)
		iterations = targetIterations
	}
	return baseline, results, iterations
}

func rerunBulkSimStageAdditionalIterations(request *proto.BulkSimRequest, candidates []BulkSimCandidate, config BulkSimStageConfig, progress chan *proto.ProgressMetrics, signals simsignals.Signals, concurrency int, baseline *BulkSimCandidateResult, results []*BulkSimCandidateResult, currentIterations int32, additionalIterations int32) (*BulkSimCandidateResult, []*BulkSimCandidateResult) {
	totalSims := len(candidates) + 1
	totalIterations := int32(totalSims) * additionalIterations
	emitBulkSimStageProgress(progress, config.Stage, 0, totalSims, 0, totalIterations, 0)

	baselineExtra := runSingleBulkSimWithProgressAndSeedOffset(request, BulkSimCandidate{Index: -1, Gear: request.BaselineGear}, additionalIterations, currentIterations, signals, config.UseConcurrentSim, func(progressMetrics *proto.ProgressMetrics) {
		if progressMetrics.TotalIterations == 0 {
			return
		}
		emitBulkSimStageProgress(progress, config.Stage, 0, totalSims, min(progressMetrics.CompletedIterations, additionalIterations), totalIterations, progressMetrics.Dps)
	})
	if baselineExtra.Error != nil {
		return baselineExtra, results
	}
	baseline = mergeBulkSimCandidateResults(baseline, baselineExtra)
	emitBulkSimStageProgress(progress, config.Stage, 1, totalSims, additionalIterations, totalIterations, baseline.DpsMetrics.Avg)

	jobs := make(chan BulkSimStageTask, len(candidates))
	stageResults := make(chan *BulkSimCandidateResult, len(candidates))
	progressTracker := &BulkSimStageProgressTracker{
		stage:                               config.Stage,
		progress:                            progress,
		totalCandidates:                     len(candidates),
		totalSims:                           totalSims,
		iterations:                          additionalIterations,
		totalIterations:                     totalIterations,
		completedSimsBeforeCandidates:       1,
		completedIterationsBeforeCandidates: additionalIterations,
		completedIterationsByCandidate:      make([]int32, len(candidates)),
	}
	var wg sync.WaitGroup

	for range concurrency {
		wg.Go(func() {
			for task := range jobs {
				if signals.Abort.IsTriggered() {
					return
				}

				candidateResult := runSingleBulkSimWithProgressAndSeedOffset(request, task.Candidate, additionalIterations, currentIterations, signals, config.UseConcurrentSim, func(progressMetrics *proto.ProgressMetrics) {
					progressTracker.reportCandidateProgress(task.Position, progressMetrics)
				})
				progressTracker.reportCandidateComplete(task.Position, candidateResult)
				stageResults <- candidateResult
			}
		})
	}

	go func() {
		defer close(jobs)
		for idx, candidate := range candidates {
			if signals.Abort.IsTriggered() {
				return
			}
			jobs <- BulkSimStageTask{Candidate: candidate, Position: idx}
		}
	}()

	go func() {
		wg.Wait()
		close(stageResults)
	}()

	additionalResults := make([]*BulkSimCandidateResult, 0, len(candidates))
	for candidateResult := range stageResults {
		additionalResults = append(additionalResults, candidateResult)
		if candidateResult.Error != nil {
			signals.Abort.Trigger()
		}
	}
	return baseline, mergeBulkSimCandidateResultSlices(results, additionalResults)
}

func mergeBulkSimCandidateResultSlices(results []*BulkSimCandidateResult, additionalResults []*BulkSimCandidateResult) []*BulkSimCandidateResult {
	additionalByCandidate := make(map[int32]*BulkSimCandidateResult, len(additionalResults))
	for _, result := range additionalResults {
		if result != nil {
			additionalByCandidate[result.Candidate.Index] = result
		}
	}

	merged := make([]*BulkSimCandidateResult, 0, len(results))
	for _, result := range results {
		if result == nil {
			continue
		}
		additionalResult, ok := additionalByCandidate[result.Candidate.Index]
		if !ok {
			merged = append(merged, result)
			continue
		}
		merged = append(merged, mergeBulkSimCandidateResults(result, additionalResult))
	}
	return merged
}

func mergeBulkSimCandidateResults(result *BulkSimCandidateResult, additionalResult *BulkSimCandidateResult) *BulkSimCandidateResult {
	if result == nil || result.Error != nil {
		return result
	}
	if additionalResult == nil || additionalResult.Error != nil {
		return additionalResult
	}

	return &BulkSimCandidateResult{
		Candidate:  result.Candidate,
		DpsMetrics: mergeBulkSimDistributionMetrics(result.DpsMetrics, additionalResult.DpsMetrics),
	}
}

func mergeBulkSimDistributionMetrics(metrics *proto.DistributionMetrics, additionalMetrics *proto.DistributionMetrics) *proto.DistributionMetrics {
	if metrics == nil {
		return additionalMetrics
	}
	if additionalMetrics == nil {
		return metrics
	}

	metricsAggregator := bulkSimDistributionMetricsAggregatorData(metrics)
	additionalAggregator := bulkSimDistributionMetricsAggregatorData(additionalMetrics)
	totalN := metricsAggregator.N + additionalAggregator.N
	if totalN <= 0 {
		return googleProto.Clone(metrics).(*proto.DistributionMetrics)
	}

	combiner := raidSimResultCombiner{}
	combinedMetrics := combiner.newDistMetrics()
	combiner.combineDistMetrics(combinedMetrics, metrics, false, float64(metricsAggregator.N)/float64(totalN))
	combiner.combineDistMetrics(combinedMetrics, additionalMetrics, true, float64(additionalAggregator.N)/float64(totalN))
	return combinedMetrics
}

func bulkSimDistributionMetricsAggregatorData(metrics *proto.DistributionMetrics) *proto.AggregatorData {
	if metrics.AggregatorData != nil && metrics.AggregatorData.N > 0 {
		return metrics.AggregatorData
	}
	n := int32(1)
	return &proto.AggregatorData{
		N:     n,
		SumSq: (metrics.Stdev*metrics.Stdev + metrics.Avg*metrics.Avg) * float64(n),
	}
}

func hasBulkSimStageError(baseline *BulkSimCandidateResult, results []*BulkSimCandidateResult) bool {
	if baseline != nil && baseline.Error != nil {
		return true
	}
	for _, result := range results {
		if result != nil && result.Error != nil {
			return true
		}
	}
	return false
}

func topBulkSimResults(results []*BulkSimCandidateResult, limit int) []*BulkSimCandidateResult {
	if limit <= 0 || len(results) == 0 {
		return nil
	}
	if len(results) <= limit {
		topResults := append([]*BulkSimCandidateResult(nil), results...)
		sortBulkSimResultsByDps(topResults)
		return topResults
	}

	topResults := make(bulkSimResultMinHeap, 0, limit)
	for _, result := range results {
		if result == nil || result.DpsMetrics == nil {
			continue
		}
		if topResults.Len() < limit {
			heap.Push(&topResults, result)
			continue
		}
		if result.DpsMetrics.Avg > topResults[0].DpsMetrics.Avg {
			topResults[0] = result
			heap.Fix(&topResults, 0)
		}
	}

	result := []*BulkSimCandidateResult(topResults)
	sortBulkSimResultsByDps(result)
	return result
}

func sortBulkSimResultsByDps(results []*BulkSimCandidateResult) {
	slices.SortFunc(results, func(a, b *BulkSimCandidateResult) int {
		return cmp.Compare(b.DpsMetrics.Avg, a.DpsMetrics.Avg)
	})
}

func bulkSimResultsToCandidates(results []*BulkSimCandidateResult) []BulkSimCandidate {
	return MapSlice(results, func(result *BulkSimCandidateResult) BulkSimCandidate {
		return result.Candidate
	})
}

func bulkSimCandidateResultToProto(result *BulkSimCandidateResult) *proto.BulkGearResult {
	if result == nil {
		return nil
	}
	return &proto.BulkGearResult{
		CandidateIndex: result.Candidate.Index,
		Gear:           result.Candidate.Gear,
		DpsMetrics:     result.DpsMetrics,
	}
}

func cleanBulkSimDpsMetrics(metrics *proto.DistributionMetrics) *proto.DistributionMetrics {
	if metrics == nil {
		return nil
	}
	clone := googleProto.Clone(metrics).(*proto.DistributionMetrics)
	clone.Hist = nil
	clone.AllValues = nil
	return clone
}

func bestBulkSimDps(results []*BulkSimCandidateResult) float64 {
	best := 0.0
	for _, result := range results {
		if result != nil && result.DpsMetrics != nil {
			best = math.Max(best, result.DpsMetrics.Avg)
		}
	}
	return best
}

func bulkSimAbortedError() *proto.ErrorOutcome {
	return &proto.ErrorOutcome{Type: proto.ErrorOutcomeType_ErrorOutcomeAborted, Message: "Bulk Sim Aborted"}
}

func emitBulkSimStageProgress(progress chan *proto.ProgressMetrics, stage proto.BulkSimStage, completedSims int, totalSims int, completedIterations int32, totalIterations int32, dps float64) {
	if progress == nil {
		return
	}

	progress <- &proto.ProgressMetrics{
		BulkStage:           stage,
		CompletedSims:       int32(completedSims),
		TotalSims:           int32(totalSims),
		CompletedIterations: completedIterations,
		TotalIterations:     totalIterations,
		Dps:                 dps,
	}
}

func (tracker *BulkSimStageProgressTracker) reportCandidateProgress(position int, progressMetrics *proto.ProgressMetrics) {
	if tracker.progress == nil || progressMetrics == nil || position < 0 || position >= tracker.totalCandidates || progressMetrics.TotalIterations == 0 {
		return
	}

	completedIterations := min(progressMetrics.CompletedIterations, tracker.iterations)
	tracker.mutex.Lock()
	shouldEmit := tracker.shouldEmitProgressLocked(false)
	if completedIterations > tracker.completedIterationsByCandidate[position] {
		tracker.completedCandidateIterations += completedIterations - tracker.completedIterationsByCandidate[position]
		tracker.completedIterationsByCandidate[position] = completedIterations
		shouldEmit = shouldEmit || tracker.shouldEmitProgressLocked(false)
	}
	totalCompletedIterations := tracker.completedIterationsBeforeCandidates + tracker.completedCandidateIterations
	completedSims := tracker.completedSimsBeforeCandidates + tracker.completedCandidates
	if shouldEmit {
		tracker.lastProgressEmit = time.Now()
	}
	tracker.mutex.Unlock()
	if !shouldEmit {
		return
	}

	emitBulkSimStageProgress(
		tracker.progress,
		tracker.stage,
		completedSims,
		tracker.totalSims,
		totalCompletedIterations,
		tracker.totalIterations,
		progressMetrics.Dps,
	)
}

func (tracker *BulkSimStageProgressTracker) reportCandidateComplete(position int, result *BulkSimCandidateResult) {
	if tracker.progress == nil || position < 0 || position >= tracker.totalCandidates {
		return
	}

	dps := 0.0
	if result != nil && result.DpsMetrics != nil {
		dps = result.DpsMetrics.Avg
	}

	tracker.mutex.Lock()
	if tracker.iterations > tracker.completedIterationsByCandidate[position] {
		tracker.completedCandidateIterations += tracker.iterations - tracker.completedIterationsByCandidate[position]
	}
	tracker.completedIterationsByCandidate[position] = tracker.iterations
	tracker.completedCandidates++
	totalCompletedIterations := tracker.completedIterationsBeforeCandidates + tracker.completedCandidateIterations
	completedSims := tracker.completedSimsBeforeCandidates + tracker.completedCandidates
	tracker.lastProgressEmit = time.Now()
	tracker.mutex.Unlock()

	emitBulkSimStageProgress(
		tracker.progress,
		tracker.stage,
		completedSims,
		tracker.totalSims,
		totalCompletedIterations,
		tracker.totalIterations,
		dps,
	)
}

func (tracker *BulkSimStageProgressTracker) shouldEmitProgressLocked(force bool) bool {
	return force || tracker.lastProgressEmit.IsZero() || time.Since(tracker.lastProgressEmit) >= bulkSimProgressThrottle
}

func setBulkSimStageTiming(timings *proto.BulkSimTimings, stage proto.BulkSimStage, durationSeconds float64) {
	switch stage {
	case proto.BulkSimStage_BulkSimStageLow:
		timings.LowStageSeconds = durationSeconds
	case proto.BulkSimStage_BulkSimStageMedium:
		timings.MediumStageSeconds = durationSeconds
	case proto.BulkSimStage_BulkSimStageHigh:
		timings.HighStageSeconds = durationSeconds
	}
}

func formatBulkSimStageStart(config BulkSimStageConfig, candidateCount int, concurrency int, minIterations int32) string {
	return fmt.Sprintf("- Stage: %s - Starting\n"+
		"Sims:\n"+
		"  Candidates: %d\n"+
		"  Total runs: %d-%d (baseline probe, optional baseline, candidates)\n"+
		"Stage config:\n"+
		"  Concurrency: %d\n"+
		"  Per-candidate concurrent sim: %t\n"+
		"  Min iterations: %d\n"+
		"  Target error: %.2f%%",
		bulkSimStageLogName(config.Stage),
		candidateCount,
		candidateCount+1,
		candidateCount+2,
		concurrency,
		config.UseConcurrentSim,
		minIterations,
		config.TargetErrorPct,
	)
}

func formatBulkSimStageSummary(status string, metrics *proto.BulkSimStageMetrics, completedSims int) string {
	return fmt.Sprintf("- Stage: %s - %s\n"+
		"Sims:\n"+
		"  Input gear sets: %d\n"+
		"  Completed candidates: %d\n"+
		"  Survivors: %d\n"+
		"Results:\n"+
		"  Iterations: %d\n"+
		"  Target error: %.2f%%\n"+
		"  Observed error: %.2f%%\n"+
		"  Best candidate DPS: %.2f\n"+
		"  Baseline DPS: %.2f\n"+
		"Timing:\n"+
		"  Duration: %.2fs",
		bulkSimStageLogName(metrics.Stage),
		status,
		metrics.InputGearSets,
		completedSims,
		metrics.Survivors,
		metrics.Iterations,
		metrics.TargetErrorPct,
		metrics.ObservedErrorPct,
		metrics.BestCandidateAvgDps,
		metrics.BaselineAvgDps,
		metrics.DurationSeconds,
	)
}

func bulkSimStageLogName(stage proto.BulkSimStage) string {
	switch stage {
	case proto.BulkSimStage_BulkSimStageLow:
		return "low"
	case proto.BulkSimStage_BulkSimStageMedium:
		return "medium"
	case proto.BulkSimStage_BulkSimStageHigh:
		return "high"
	default:
		return stage.String()
	}
}
