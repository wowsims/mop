import { DistributionMetrics } from '../../proto/api';
import { BULK_SIM_COMBINATION_LOG_MIN, BULK_SIM_CULLING_COEFFICIENT, BULK_SIM_SURVIVOR_SOFT_CAP_MULTIPLIER } from './constants';
import { getBulkSimStageMaxSurvivors } from './stage';
import { ConcurrentBulkSimCandidate, ConcurrentBulkSimCandidateResult, ConcurrentBulkSimStageConfig } from './types';

export const getBulkSimTargetIterations = (targetErrorPct: number, metrics: DistributionMetrics | undefined, candidateCount: number): number => {
	if (!metrics || metrics.avg <= 0) return 0;

	const targetError = metrics.avg * (targetErrorPct / 100);
	if (targetError <= 0) return 0;

	const combinationMultiplier = bulkSimCombinationErrorMultiplier(candidateCount);
	return Math.ceil(Math.pow((metrics.stdev * combinationMultiplier) / targetError, 2));
};

const bulkSimDpsError = (metrics: DistributionMetrics | undefined, iterations: number): number => {
	if (!metrics || iterations <= 0) return 0;
	return metrics.stdev / Math.sqrt(iterations);
};

const bulkSimCombinationErrorMultiplier = (candidateCount: number): number =>
	Math.sqrt(Math.max(1, Math.log10(Math.max(candidateCount, BULK_SIM_COMBINATION_LOG_MIN))));

const bulkSimSurvivorIntervalMultiplier = (candidateCount: number, cullingCoefficient: number): number =>
	cullingCoefficient * bulkSimCombinationErrorMultiplier(candidateCount);

const bulkSimObservedErrorPct = (metrics: DistributionMetrics | undefined, iterations: number, candidateCount: number): number => {
	if (!metrics || metrics.avg <= 0 || iterations <= 0) return 0;
	return (bulkSimDpsError(metrics, iterations) * bulkSimCombinationErrorMultiplier(candidateCount) * 100) / metrics.avg;
};

export const bulkSimObservedStageErrorPct = (
	baseline: ConcurrentBulkSimCandidateResult | undefined,
	results: ConcurrentBulkSimCandidateResult[],
	iterations: number,
	candidateCount: number,
): number => {
	let observedErrorPct = bulkSimObservedErrorPct(baseline?.dpsMetrics, iterations, candidateCount);
	for (const result of results) {
		observedErrorPct = Math.max(observedErrorPct, bulkSimObservedErrorPct(result.dpsMetrics, iterations, candidateCount));
	}
	return observedErrorPct;
};

export const getBulkSimStageTargetIterations = (
	targetErrorPct: number,
	baseline: ConcurrentBulkSimCandidateResult | undefined,
	results: ConcurrentBulkSimCandidateResult[],
	candidateCount: number,
): number => {
	let targetIterations = getBulkSimTargetIterations(targetErrorPct, baseline?.dpsMetrics, candidateCount);
	for (const result of results) {
		targetIterations = Math.max(targetIterations, getBulkSimTargetIterations(targetErrorPct, result.dpsMetrics, candidateCount));
	}
	return targetIterations;
};

export const topBulkSimResults = (results: ConcurrentBulkSimCandidateResult[], limit: number): ConcurrentBulkSimCandidateResult[] => {
	if (limit <= 0 || results.length == 0) return [];
	return results
		.filter(result => result.dpsMetrics)
		.slice()
		.sort((a, b) => b.dpsMetrics!.avg - a.dpsMetrics!.avg)
		.slice(0, limit);
};

export const selectBulkSimSurvivors = (
	results: ConcurrentBulkSimCandidateResult[],
	baseline: ConcurrentBulkSimCandidateResult,
	iterations: number,
	config: ConcurrentBulkSimStageConfig,
	originalCandidateCount: number,
): ConcurrentBulkSimCandidate[] => {
	const maxSurvivors = getBulkSimStageMaxSurvivors(config, results.length);
	if (maxSurvivors === undefined || results.length <= maxSurvivors) {
		return results.map(result => result.candidate);
	}

	let bestMetrics = baseline.dpsMetrics;
	for (const result of results) {
		if (result.dpsMetrics && (!bestMetrics || result.dpsMetrics.avg > bestMetrics.avg)) {
			bestMetrics = result.dpsMetrics;
		}
	}

	const intervalMultiplier = bulkSimSurvivorIntervalMultiplier(originalCandidateCount, config.cullingCoefficient ?? BULK_SIM_CULLING_COEFFICIENT);
	const bestLowerBound = (bestMetrics?.avg ?? 0) - bulkSimDpsError(bestMetrics, iterations) * intervalMultiplier;
	const meanSurvivors = topBulkSimResults(results, config.minSurvivors ?? 0);
	let survivors = meanSurvivors.slice();
	const seen = new Set(survivors.map(result => result.candidate.index));

	for (const result of results) {
		if (!result.dpsMetrics || seen.has(result.candidate.index)) continue;

		const candidateUpperBound = result.dpsMetrics.avg + bulkSimDpsError(result.dpsMetrics, iterations) * intervalMultiplier;
		if (candidateUpperBound < bestLowerBound) continue;

		survivors.push(result);
		seen.add(result.candidate.index);
	}

	const softMaxSurvivors = maxSurvivors * BULK_SIM_SURVIVOR_SOFT_CAP_MULTIPLIER;
	if (survivors.length > softMaxSurvivors) {
		survivors = topBulkSimResults(survivors, softMaxSurvivors);
	}

	return survivors.map(result => result.candidate);
};
