package bulk

import (
	"github.com/wowsims/mop/sim/core/proto"
)

func shouldUseLegacyBulkSim(settings *proto.BulkSettings, highStageIterations int32, candidateCount int) bool {
	if settings != nil && settings.GetUseLegacyBulkSim() {
		return true
	}
	if candidateCount < BulkSimMinCombinations {
		return true
	}

	fullRunIterations := int64(highStageIterations) * int64(candidateCount)
	estimatedMultistageIterationsUpperBound := getBulkSimOptimisationIterationsUpperBound(highStageIterations, candidateCount)
	return estimatedMultistageIterationsUpperBound >= fullRunIterations
}

func getBulkSimOptimisationIterationsUpperBound(highStageIterations int32, candidateCount int) int64 {
	remainingCandidates := candidateCount
	var iterations int64

	for _, stageConfig := range BulkSimStageConfigs {
		if stageConfig.Stage == proto.BulkSimStage_BulkSimStageHigh {
			break
		}
		if !shouldRunBulkSimStage(stageConfig, remainingCandidates) {
			continue
		}

		stageIterations := getBulkSimStageMinIterations(highStageIterations, stageConfig)
		iterations += int64(stageIterations) * int64(remainingCandidates+1)
		remainingCandidates = min(remainingCandidates, getBulkSimStageMaxSurvivors(stageConfig, remainingCandidates))
	}

	return iterations + int64(highStageIterations)*int64(remainingCandidates+1)
}

func estimateBulkSimIterations(settings *proto.BulkSettings, highStageIterations int32, candidateCount int) (int64, bool) {
	if shouldUseLegacyBulkSim(settings, highStageIterations, candidateCount) {
		return int64(highStageIterations) * int64(candidateCount), true
	}

	return getBulkSimOptimisationIterationsUpperBound(highStageIterations, candidateCount), false
}
