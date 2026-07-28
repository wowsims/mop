import { BulkSimRequest, BulkSimStage } from '../../proto/api';
import { BULK_SIM_MIN_COMBINATIONS } from './constants';
import { bulkSimStageConfigs, getBulkSimStageMaxSurvivors, getBulkSimStageMinIterations, shouldRunBulkSimStage } from './stage';

export const shouldUseLegacyBulkSim = (request: BulkSimRequest, candidateCount: number): boolean => {
	const settings = request.bulkSettings;
	if (settings?.useLegacyBulkSim) {
		return true;
	}
	if (candidateCount < BULK_SIM_MIN_COMBINATIONS) {
		return true;
	}

	const highStageIterations = request.highStageIterations;
	let remainingCandidates = candidateCount;
	let estimatedOptimisationIterationsUpperBound = 0;

	for (const config of bulkSimStageConfigs) {
		if (config.stage === BulkSimStage.BulkSimStageHigh) {
			break;
		}
		if (!shouldRunBulkSimStage(config, remainingCandidates)) {
			continue;
		}

		estimatedOptimisationIterationsUpperBound += getBulkSimStageMinIterations(request, config) * (remainingCandidates + 1);
		remainingCandidates = Math.min(remainingCandidates, getBulkSimStageMaxSurvivors(config, remainingCandidates) ?? remainingCandidates);
	}

	estimatedOptimisationIterationsUpperBound +=
		getBulkSimStageMinIterations(request, bulkSimStageConfigs[bulkSimStageConfigs.length - 1]!) * (remainingCandidates + 1);
	return estimatedOptimisationIterationsUpperBound >= highStageIterations * candidateCount;
};
