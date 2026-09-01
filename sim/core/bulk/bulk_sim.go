package bulk

import (
	"log"
	"time"

	"github.com/wowsims/mop/sim/core/proto"
	"github.com/wowsims/mop/sim/core/simsignals"
)

const (
	BulkSimDefaultTopResults                           = 5
	BulkSimMinCombinations                             = 20
	BulkSimCullingCoefficient                          = 1.35
	bulkSimLowStageConcurrencyFactor                   = 2
	BulkSimCombinationLogMin                   float64 = 10
	BulkSimMaxAdaptivePasses                           = 2
	BulkSimAdaptiveMaxIterationMultiplier              = 4
	BulkSimFinalistMaxExtraIterationMultiplier         = 3 // The extra iterations the finalist stage may add per finalist
	BulkSimSurvivorSoftCapMultiplier                   = 2
	BulkSimLowStageSurvivorScaleReference              = 1000
	BulkSimMediumStageSurvivorScaleReference           = 100
	BulkSimProgressThrottle                            = 100 * time.Millisecond // Minimum interval between progress emits
)

type BulkSimCandidate struct {
	Index int32
	Gear  *proto.EquipmentSpec
}

type BulkSimCandidateResult struct {
	Candidate  BulkSimCandidate
	DpsMetrics *proto.DistributionMetrics
	Error      *proto.ErrorOutcome
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
		topResults = BulkSimDefaultTopResults
	}

	result := &proto.BulkSimResult{
		Timings:             &proto.BulkSimTimings{},
		OptimizedCandidates: request.GetOptimizedCandidates(),
	}
	baselineGear := GetBulkSimBaselineGear(request)

	if len(candidates) == 0 {
		baselineResult := runSingleBulkSim(request, BulkSimCandidate{Index: -1, Gear: baselineGear}, request.BaseRequest.SimOptions.Iterations, signals)
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
	var carry *bulkSimStageCarryOver
	useLegacyBulkSim := shouldUseLegacyBulkSim(request.GetBulkSettings(), request.HighStageIterations, len(candidates))
	// Culling intervals are corrected for how many candidates the run started with,
	// not for how many are left: the survivors were themselves selected by the same
	// noisy metric, so recomputing the correction on the shrinking set would weaken
	// it exactly as the decisions become final. Iteration targeting deliberately
	// keeps using the current stage's count - driving it from the original count
	// inflates the final stage's iterations (measured +17.6%) without changing which
	// gear set wins.
	originalCandidateCount := len(candidates)

	for _, stageConfig := range BulkSimStageConfigs {
		if signals.Abort.IsTriggered() {
			result.Error = bulkSimAbortedError()
			return result
		}

		if useLegacyBulkSim && stageConfig.Stage != proto.BulkSimStage_BulkSimStageHigh {
			continue
		}
		if !shouldRunBulkSimStage(stageConfig, len(candidates)) {
			continue
		}

		stageResult := runBulkSimStage(request, candidates, stageConfig, carry, progress, signals)
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
		carry = newBulkSimStageCarryOver(stageResult)
		result.StageMetrics = append(result.StageMetrics, stageResult.Metrics)
		setBulkSimStageTiming(result.Timings, stageConfig.Stage, stageResult.Metrics.DurationSeconds)

		if stageConfig.MaxSurvivors > 0 {
			candidates = selectBulkSimSurvivors(stageResult.Results, stageResult.Baseline, stageResult.Iterations, stageConfig, originalCandidateCount)
			stageResult.Metrics.Survivors = int32(len(candidates))
		}
		log.Printf("[Bulk Sim] %s", formatBulkSimStageSummary("Finished", stageResult.Metrics, len(stageResult.Results)))
	}

	// A cancel that lands after the last stage's workers returned would otherwise be
	// reported as a completed run built from a partially simmed candidate set.
	if signals.Abort.IsTriggered() {
		result.Error = bulkSimAbortedError()
		return result
	}

	if latestBaseline == nil {
		baselineResult := runSingleBulkSim(request, BulkSimCandidate{Index: -1, Gear: baselineGear}, request.BaseRequest.SimOptions.Iterations, signals)
		if baselineResult.Error != nil {
			result.Error = baselineResult.Error
			return result
		}
		latestBaseline = baselineResult
	}
	if latestResults == nil {
		latestResults = []*BulkSimCandidateResult{}
	}

	// Finalist refinement: add lockstep iterations to the displayed top results until their
	// ranking is statistically separated (or the budget runs out), so near-ties do not flip
	// order between runs with different seeds.
	var finalistMetrics *proto.BulkSimStageMetrics
	latestBaseline, latestResults, finalistMetrics = runBulkSimFinalistStage(request, latestBaseline, latestResults, topResults, progress, signals)
	if finalistMetrics != nil {
		result.StageMetrics = append(result.StageMetrics, finalistMetrics)
		setBulkSimStageTiming(result.Timings, proto.BulkSimStage_BulkSimStageFinalist, finalistMetrics.DurationSeconds)
	}
	if signals.Abort.IsTriggered() {
		result.Error = bulkSimAbortedError()
		return result
	}

	result.Baseline = bulkSimCandidateResultToProto(latestBaseline)
	top := topBulkSimResults(latestResults, topResults)
	for idx, candidateResult := range top {
		protoResult := bulkSimCandidateResultToProto(candidateResult)
		// Paired errors for the ranking display: candidates share seed sequences, so the
		// uncertainty of a DPS *difference* is the paired standard error - far tighter than
		// what the per-result stdev suggests. Computed here, before AllValues are stripped.
		if idx+1 < len(top) {
			if pairedError, ok := bulkSimPairedDpsError(top[idx+1].DpsMetrics, candidateResult.DpsMetrics); ok {
				protoResult.PairedErrorToNextResult = pairedError
			}
		}
		if pairedError, ok := bulkSimPairedDpsError(candidateResult.DpsMetrics, latestBaseline.DpsMetrics); ok {
			protoResult.PairedErrorToBaseline = pairedError
		}
		result.TopResults = append(result.TopResults, protoResult)
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
	player, err := getBulkSimPlayer(request.BaseRequest.Raid)
	if err != "" {
		return err
	}
	if player.GetEquipment() == nil {
		return "[Bulk sim] Baseline gear is empty"
	}
	return ""
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

// GetBulkSimBaselineGear returns the raid's single bulk player's equipment, or nil.
func GetBulkSimBaselineGear(request *proto.BulkSimRequest) *proto.EquipmentSpec {
	player, _ := getBulkSimPlayer(request.GetBaseRequest().GetRaid())
	if player == nil {
		return nil
	}
	return player.GetEquipment()
}
