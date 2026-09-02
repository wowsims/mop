import { DistributionMetrics } from '@core/proto/api';

import { Z_95 } from '../../utils';
import { BULK_SIM_COMBINATION_LOG_MIN, BULK_SIM_CULLING_COEFFICIENT, BULK_SIM_SURVIVOR_SOFT_CAP_MULTIPLIER } from './constants_auto_gen';
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
		.sort((a, b) => b.dpsMetrics!.avg - a.dpsMetrics!.avg)
		.slice(0, limit);
};

// The marginal cull test compares the sum of both candidates' half-widths, which is
// sqrt(2) wider than the standard error of the difference it is really testing. Keeping
// that factor when switching to the paired estimate means pairing only removes the
// variance the shared seeds already cancel - it does not additionally tighten the
// interval.
const BULK_SIM_PAIRED_INTERVAL_CONSERVATISM = Math.SQRT2;

// Standard error of the mean per-iteration difference between a candidate and the
// leader. Returns undefined when the two runs cannot be paired; zero is a valid result -
// it means the candidate trailed the leader by the same amount every iteration, which is
// the strongest evidence pairing can give.
export const bulkSimPairedDpsError = (metrics: DistributionMetrics | undefined, bestMetrics: DistributionMetrics | undefined): number | undefined => {
	const values = metrics?.allValues;
	const bestValues = bestMetrics?.allValues;
	if (!values || !bestValues || values.length === 0 || values.length !== bestValues.length) return undefined;

	let sum = 0;
	let sumSq = 0;
	for (let idx = 0; idx < values.length; idx++) {
		const difference = values[idx] - bestValues[idx];
		sum += difference;
		sumSq += difference * difference;
	}
	const count = values.length;
	const mean = sum / count;
	return Math.sqrt(Math.max(0, sumSq / count - mean * mean) / count);
};

// Decides whether a candidate is far enough behind the leader to drop out. Every
// candidate is simmed on the same seed sequence, so most of the per-iteration noise is
// shared between any two of them; differencing the paired values keeps that, which
// resolves the same gap with fewer iterations. Falls back to the marginal comparison when
// the values are unavailable or not aligned.
const bulkSimCandidateIsCulled = (
	metrics: DistributionMetrics,
	bestMetrics: DistributionMetrics | undefined,
	bestLowerBound: number,
	iterations: number,
	intervalMultiplier: number,
): boolean => {
	const pairedError = bulkSimPairedDpsError(metrics, bestMetrics);
	if (pairedError !== undefined && bestMetrics) {
		return bestMetrics.avg - metrics.avg > pairedError * intervalMultiplier * BULK_SIM_PAIRED_INTERVAL_CONSERVATISM;
	}

	const candidateUpperBound = metrics.avg + bulkSimDpsError(metrics, iterations) * intervalMultiplier;
	return candidateUpperBound < bestLowerBound;
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

		if (bulkSimCandidateIsCulled(result.dpsMetrics, bestMetrics, bestLowerBound, iterations, intervalMultiplier)) continue;

		survivors.push(result);
		seen.add(result.candidate.index);
	}

	const softMaxSurvivors = maxSurvivors * BULK_SIM_SURVIVOR_SOFT_CAP_MULTIPLIER;
	if (survivors.length > softMaxSurvivors) {
		survivors = topBulkSimResults(survivors, softMaxSurvivors);
	}

	return survivors.map(result => result.candidate);
};

// Whether any adjacent pair in the DPS-sorted finalist list is still statistically
// unresolved: paired z inside the same Z_95 threshold the UI's significance test uses.
// The cull's BULK_SIM_PAIRED_INTERVAL_CONSERVATISM factor is deliberately NOT applied -
// it compensates for the cull test's sum-of-half-widths formulation, while this is a
// plain two-sided test on the paired difference. An unpairable pair (or one with zero
// paired error) cannot be improved by more lockstep iterations and counts as resolved.
export const bulkSimUnresolvedFinalistPair = (sortedFinalists: ConcurrentBulkSimCandidateResult[]): boolean => {
	for (let idx = 0; idx + 1 < sortedFinalists.length; idx++) {
		const upper = sortedFinalists[idx];
		const lower = sortedFinalists[idx + 1];
		const pairedError = bulkSimPairedDpsError(lower.dpsMetrics, upper.dpsMetrics);
		if (pairedError === undefined || pairedError === 0) continue;
		if (Math.abs((upper.dpsMetrics?.avg ?? 0) - (lower.dpsMetrics?.avg ?? 0)) <= Z_95 * pairedError) return true;
	}
	return false;
};
