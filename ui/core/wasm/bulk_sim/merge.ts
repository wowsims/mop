import { BulkGearResult, DistributionMetrics } from '../../proto/api';
import { ConcurrentBulkSimCandidateResult } from './types';

export const cleanBulkSimDpsMetrics = (metrics: DistributionMetrics | undefined): DistributionMetrics | undefined => {
	if (!metrics) return undefined;
	const cleaned = DistributionMetrics.clone(metrics);
	cleaned.hist = [];
	cleaned.allValues = [];
	return cleaned;
};

export const hasBulkSimStageError = (baseline: ConcurrentBulkSimCandidateResult | undefined, results: ConcurrentBulkSimCandidateResult[]): boolean => {
	return !!baseline?.error || results.some(result => !!result.error);
};

export const mergeBulkSimCandidateResultSlices = (
	results: ConcurrentBulkSimCandidateResult[],
	additionalResults: ConcurrentBulkSimCandidateResult[],
): ConcurrentBulkSimCandidateResult[] => {
	const additionalByCandidate = new Map(additionalResults.map(result => [result.candidate.index, result]));
	return results.map(result => {
		const additionalResult = additionalByCandidate.get(result.candidate.index);
		return additionalResult ? mergeBulkSimCandidateResults(result, additionalResult) : result;
	});
};

export const mergeBulkSimCandidateResults = (
	result: ConcurrentBulkSimCandidateResult | undefined,
	additionalResult: ConcurrentBulkSimCandidateResult,
): ConcurrentBulkSimCandidateResult => {
	// Nothing carried over: the additional run is the whole result.
	if (!result) return additionalResult;
	if (result.error) return result;
	if (additionalResult.error) return additionalResult;

	return {
		candidate: result.candidate,
		dpsMetrics: mergeBulkSimDistributionMetrics(result.dpsMetrics, additionalResult.dpsMetrics),
	};
};

const mergeBulkSimDistributionMetrics = (
	metrics: DistributionMetrics | undefined,
	additionalMetrics: DistributionMetrics | undefined,
): DistributionMetrics | undefined => {
	if (!metrics) return additionalMetrics;
	if (!additionalMetrics) return metrics;

	const metricsAggregator = getBulkSimDistributionMetricsAggregatorData(metrics);
	const additionalAggregator = getBulkSimDistributionMetricsAggregatorData(additionalMetrics);
	const totalN = metricsAggregator.n + additionalAggregator.n;
	if (totalN <= 0) return DistributionMetrics.clone(metrics);

	const merged = DistributionMetrics.create({
		avg: (metrics.avg * metricsAggregator.n + additionalMetrics.avg * additionalAggregator.n) / totalN,
		max: metrics.max,
		maxSeed: metrics.maxSeed,
		min: metrics.min,
		minSeed: metrics.minSeed,
		hist: { ...metrics.hist },
		allValues: metrics.allValues.slice(),
		aggregatorData: {
			n: totalN,
			sumSq: metricsAggregator.sumSq + additionalAggregator.sumSq,
		},
	});

	if (additionalMetrics.max > merged.max) {
		merged.max = additionalMetrics.max;
		merged.maxSeed = additionalMetrics.maxSeed;
	}
	if (additionalMetrics.min == 0 || additionalMetrics.min < merged.min) {
		merged.min = additionalMetrics.min;
		merged.minSeed = additionalMetrics.minSeed;
	} else if (additionalMetrics.min == merged.min) {
		merged.minSeed = additionalMetrics.minSeed;
	}
	for (const [roundedDps, count] of Object.entries(additionalMetrics.hist)) {
		merged.hist[Number(roundedDps)] = (merged.hist[Number(roundedDps)] ?? 0) + count;
	}
	merged.allValues.push(...additionalMetrics.allValues);
	merged.stdev = Math.sqrt(Math.max(0, merged.aggregatorData!.sumSq / totalN - merged.avg * merged.avg));
	return merged;
};

const getBulkSimDistributionMetricsAggregatorData = (metrics: DistributionMetrics): { n: number; sumSq: number } => {
	if (metrics.aggregatorData && metrics.aggregatorData.n > 0) return metrics.aggregatorData;
	// Fabricating n=1 makes a merge silently mis-weight the two runs, so surface it
	// instead of letting a wrong average through unnoticed.
	console.warn('[Bulk Sim] distribution metrics are missing aggregator data; merged mean/stdev will be weighted as a single sample');
	const n = 1;
	return {
		n,
		sumSq: (metrics.stdev * metrics.stdev + metrics.avg * metrics.avg) * n,
	};
};

export const bulkSimCandidateResultToProto = (result: ConcurrentBulkSimCandidateResult | undefined): BulkGearResult | undefined => {
	if (!result) return undefined;
	return BulkGearResult.create({
		candidateIndex: result.candidate.index,
		gear: result.candidate.gear,
		dpsMetrics: result.dpsMetrics,
	});
};
