package bulk

import (
	"log"
	"math"
	"runtime"
	"time"

	"github.com/wowsims/mop/sim/core"
	"github.com/wowsims/mop/sim/core/proto"
	"github.com/wowsims/mop/sim/core/simsignals"
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

type BulkSimStageResult struct {
	Baseline   *BulkSimCandidateResult
	Results    []*BulkSimCandidateResult
	Iterations int32
	Metrics    *proto.BulkSimStageMetrics
}

func shouldRunBulkSimStage(config BulkSimStageConfig, candidateCount int) bool {
	maxSurvivors := getBulkSimStageMaxSurvivors(config, candidateCount)
	return maxSurvivors == 0 || candidateCount > maxSurvivors || candidateCount < bulkSimMinCombinations && config.Stage == proto.BulkSimStage_BulkSimStageHigh
}

func GetBulkSimStageConcurrency(request *proto.BulkSimRequest, config BulkSimStageConfig) int {
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

// Runs one low/medium/high refinement stage. Each stage first probes the
// baseline to estimate variance, then uses that variance to choose a
// per-candidate iteration count before simming every candidate. After the first
// pass, the stage may add more iterations if the observed error is still above
// the configured target.
//
// Iterations already simmed by the previous stage are carried over instead of
// being re-run: the stage only sims the delta with a seed offset and merges. That
// is exactly equivalent to running the full count from scratch, because iteration
// N always uses seed RandomSeed+N.
func runBulkSimStage(request *proto.BulkSimRequest, candidates []BulkSimCandidate, config BulkSimStageConfig, carry *bulkSimStageCarryOver, progress chan *proto.ProgressMetrics, signals simsignals.Signals) BulkSimStageResult {
	startedAt := time.Now()
	minIterations := getBulkSimStageMinIterations(request.HighStageIterations, config)
	concurrency := GetBulkSimStageConcurrency(request, config)
	concurrency = max(1, min(concurrency, len(candidates)))
	if !carry.covers(candidates) {
		carry = nil
	}
	carriedIterations := carry.carriedIterations()
	log.Printf("[Bulk Sim] %s", formatBulkSimStageStart(config, len(candidates), concurrency, minIterations, carriedIterations))
	maxBaselineSims := 2
	maxTotalSims := len(candidates) + maxBaselineSims
	probeDelta := max(0, minIterations-carriedIterations)
	probeEmitter := bulkSimStageProgressEmitter{progress: progress, stage: config.Stage, totalSims: maxTotalSims, totalIterations: int32(maxTotalSims) * probeDelta}
	probeEmitter.report(0, 0, 0)

	// Run the baseline gear up to the stage minimum to estimate DPS variance.
	// That variance is used to calculate how many iterations are needed for the
	// stage target error; user-provided high-stage iterations are treated as a
	// floor and may be raised if the probe shows more iterations are required.
	baselineProbe := carry.baselineResult()
	probeIterations := carriedIterations
	if probeDelta > 0 {
		baselineProbe = runBulkSimBaselineSegment(request, config, baselineProbe, probeDelta, carriedIterations, probeEmitter, 0, 0, signals)
		if baselineProbe.Error != nil {
			return BulkSimStageResult{Baseline: baselineProbe}
		}
		probeIterations = minIterations
	}
	probeEmitter.report(1, probeDelta, baselineProbe.DpsMetrics.Avg)

	iterations := max(getBulkSimStageIterations(request, config, baselineProbe.DpsMetrics, len(candidates)), probeIterations)
	baselineDelta := iterations - probeIterations
	candidateDelta := iterations - carriedIterations
	probeSims := core.TernaryInt(probeDelta > 0, 1, 0)
	baselineSims := probeSims + core.TernaryInt(baselineDelta > 0, 1, 0)
	candidateSims := core.TernaryInt(candidateDelta > 0, len(candidates), 0)
	totalSims := candidateSims + baselineSims
	completedBaselineIterations := probeDelta
	baseline := baselineProbe

	emitter := bulkSimStageProgressEmitter{progress: progress, stage: config.Stage, totalSims: totalSims, totalIterations: int32(candidateSims)*candidateDelta + probeDelta + baselineDelta}
	emitter.report(probeSims, completedBaselineIterations, baselineProbe.DpsMetrics.Avg)
	if baselineDelta > 0 {
		baseline = runBulkSimBaselineSegment(request, config, baselineProbe, baselineDelta, probeIterations, emitter, probeSims, probeDelta, signals)
		if baseline.Error != nil {
			return BulkSimStageResult{Baseline: baseline, Iterations: iterations}
		}
		completedBaselineIterations = probeDelta + baselineDelta
		emitter.report(baselineSims, completedBaselineIterations, baseline.DpsMetrics.Avg)
	}

	// Everything this stage needs is already covered by the carried iterations.
	if candidateDelta <= 0 {
		collected := carry.results(candidates)
		return BulkSimStageResult{
			Baseline:   baseline,
			Results:    collected,
			Iterations: iterations,
			Metrics:    bulkSimStageMetrics(config, candidates, collected, baseline, iterations, concurrency, startedAt),
		}
	}

	collected := runBulkSimCandidateBatch(request, candidates, config, bulkSimCandidateBatchConfig{
		iterations:              candidateDelta,
		seedOffset:              carriedIterations,
		concurrency:             concurrency,
		completedSimsBase:       baselineSims,
		completedIterationsBase: completedBaselineIterations,
		emitter:                 emitter,
		carried:                 carry,
	}, signals)
	baseline, collected, iterations = adaptBulkSimStageIterations(request, candidates, config, progress, signals, concurrency, baseline, collected, iterations)
	if baseline.Error != nil {
		return BulkSimStageResult{Baseline: baseline, Results: collected, Iterations: iterations}
	}

	return BulkSimStageResult{
		Baseline:   baseline,
		Results:    collected,
		Iterations: iterations,
		Metrics:    bulkSimStageMetrics(config, candidates, collected, baseline, iterations, concurrency, startedAt),
	}
}

// Runs `iterations` of the baseline gear at `seedOffset` and folds the result into
// `carried` (nil when there is nothing carried yet). Progress is reported as
// completedSimsBase sims done plus this segment's iterations on top of
// completedIterationsBase. An errored segment is returned as-is for the caller to check.
func runBulkSimBaselineSegment(request *proto.BulkSimRequest, config BulkSimStageConfig, carried *BulkSimCandidateResult, iterations int32, seedOffset int32, emitter bulkSimStageProgressEmitter, completedSimsBase int, completedIterationsBase int32, signals simsignals.Signals) *BulkSimCandidateResult {
	segment := runSingleBulkSimCandidate(request, BulkSimCandidate{Index: -1, Gear: getBulkSimBaselineGear(request)}, iterations, seedOffset, signals, config.UseConcurrentSim, func(progressMetrics *proto.ProgressMetrics) {
		if progressMetrics.TotalIterations == 0 {
			return
		}
		emitter.report(completedSimsBase, completedIterationsBase+min(progressMetrics.CompletedIterations, iterations), progressMetrics.Dps)
	})
	if segment.Error != nil {
		return segment
	}
	return mergeBulkSimCandidateResults(carried, segment)
}

func bulkSimStageMetrics(config BulkSimStageConfig, candidates []BulkSimCandidate, results []*BulkSimCandidateResult, baseline *BulkSimCandidateResult, iterations int32, concurrency int, startedAt time.Time) *proto.BulkSimStageMetrics {
	return &proto.BulkSimStageMetrics{
		Stage:               config.Stage,
		InputGearSets:       int32(len(candidates)),
		Survivors:           int32(len(results)),
		Iterations:          iterations,
		Concurrency:         int32(concurrency),
		DurationSeconds:     time.Since(startedAt).Seconds(),
		TargetErrorPct:      config.TargetErrorPct,
		ObservedErrorPct:    bulkSimObservedStageErrorPct(baseline, results, iterations, len(candidates)),
		BaselineAvgDps:      baseline.DpsMetrics.Avg,
		BestCandidateAvgDps: bestBulkSimDps(results),
	}
}

// The user-provided high-stage iteration count acts as the floor for the high stage;
// every other stage uses its own configured minimum.
func getBulkSimStageMinIterations(highStageIterations int32, config BulkSimStageConfig) int32 {
	if config.Stage == proto.BulkSimStage_BulkSimStageHigh && highStageIterations > 0 {
		return highStageIterations
	}
	return config.MinIterations
}

func getBulkSimStageIterations(request *proto.BulkSimRequest, config BulkSimStageConfig, baselineMetrics *proto.DistributionMetrics, candidateCount int) int32 {
	minIterations := getBulkSimStageMinIterations(request.HighStageIterations, config)
	// The user-defined high-stage iteration count is a floor, not a cap. Every
	// stage still uses enough iterations to satisfy its target error when needed.
	targetIterations := getBulkSimTargetIterations(config.TargetErrorPct, baselineMetrics, candidateCount)
	return max(minIterations, targetIterations)
}

func getBulkSimStageMaxSurvivors(config BulkSimStageConfig, candidateCount int) int {
	if config.MaxSurvivors == 0 {
		return config.MaxSurvivors
	}

	var scaleReference int
	switch config.Stage {
	case proto.BulkSimStage_BulkSimStageLow:
		scaleReference = bulkSimLowStageSurvivorScaleReference
	case proto.BulkSimStage_BulkSimStageMedium:
		scaleReference = bulkSimMediumStageSurvivorScaleReference
	default:
		return config.MaxSurvivors
	}

	if candidateCount <= scaleReference {
		return config.MaxSurvivors
	}

	scale := math.Sqrt(float64(candidateCount) / float64(scaleReference))
	return max(config.MaxSurvivors, int(math.Ceil(float64(config.MaxSurvivors)*scale)))
}

// Adds bounded extra iterations when the completed stage missed its target
// error. Extra sims use seed offsets and are merged into the existing metrics,
// avoiding a full rerun while still reducing standard error for the same
// baseline/candidate set.
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

// Runs only the delta required by an adaptive pass. The seed offset prevents
// reusing the same random sequence as the previous pass, and the returned
// metrics are merged with the existing stage results by candidate index.
func rerunBulkSimStageAdditionalIterations(request *proto.BulkSimRequest, candidates []BulkSimCandidate, config BulkSimStageConfig, progress chan *proto.ProgressMetrics, signals simsignals.Signals, concurrency int, baseline *BulkSimCandidateResult, results []*BulkSimCandidateResult, currentIterations int32, additionalIterations int32) (*BulkSimCandidateResult, []*BulkSimCandidateResult) {
	totalSims := len(candidates) + 1
	emitter := bulkSimStageProgressEmitter{progress: progress, stage: config.Stage, totalSims: totalSims, totalIterations: int32(totalSims) * additionalIterations}
	emitter.report(0, 0, 0)

	baselineExtra := runBulkSimBaselineSegment(request, config, baseline, additionalIterations, currentIterations, emitter, 0, 0, signals)
	if baselineExtra.Error != nil {
		return baselineExtra, results
	}
	baseline = baselineExtra
	emitter.report(1, additionalIterations, baseline.DpsMetrics.Avg)

	// The pass so far is the carry-over for this batch, so the extra iterations are
	// merged into each candidate as they complete - exactly like a stage carrying its
	// predecessor's iterations.
	return baseline, runBulkSimCandidateBatch(request, candidates, config, bulkSimCandidateBatchConfig{
		iterations:              additionalIterations,
		seedOffset:              currentIterations,
		concurrency:             concurrency,
		completedSimsBase:       1,
		completedIterationsBase: additionalIterations,
		emitter:                 emitter,
		carried:                 bulkSimCarryOverFromResults(currentIterations, baseline, results),
	}, signals)
}
