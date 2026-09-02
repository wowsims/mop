import { BulkSimRequest, BulkSimStage, BulkSimStageMetrics, DistributionMetrics, ErrorOutcome } from '@generated/proto/api';

import { SimSignals } from '../../sim_signal_manager';
import { isDevMode } from '../../utils';
import { WorkerPool, WorkerProgressCallback } from '../../worker_pool';
import { BulkSimCandidateTransport, runBulkSimCandidateBatchOnWorkers, runSingleBulkSimCandidate } from './batch';
import { bulkSimCarriedResults, bulkSimCarryOverCovers, ConcurrentBulkSimStageCarryOver } from './carry_over';
import {
	BULK_SIM_ADAPTIVE_MAX_ITERATION_MULTIPLIER,
	BULK_SIM_FINALIST_MAX_EXTRA_ITERATION_MULTIPLIER,
	BULK_SIM_LOW_STAGE_SURVIVOR_SCALE_REFERENCE,
	BULK_SIM_MAX_ADAPTIVE_PASSES,
	BULK_SIM_MEDIUM_STAGE_SURVIVOR_SCALE_REFERENCE,
	BULK_SIM_MIN_COMBINATIONS,
	BULK_SIM_STAGE_CONFIGS,
} from './constants_auto_gen';
import { hasBulkSimStageError, mergeBulkSimCandidateResults, mergeBulkSimCandidateResultSlices } from './merge';
import {
	bulkSimStageLogName,
	BulkSimStageProgressEmitter,
	formatBulkSimStageStart,
	formatBulkSimStageSummary,
	makeBulkSimStageProgressEmitter,
} from './progress';
import {
	bulkSimObservedStageErrorPct,
	bulkSimUnresolvedFinalistPair,
	getBulkSimStageTargetIterations,
	getBulkSimTargetIterations,
	topBulkSimResults,
} from './statistics';
import {
	ConcurrentBulkSimCandidate,
	ConcurrentBulkSimCandidateResult,
	ConcurrentBulkSimStageConfig,
	ConcurrentBulkSimStageResult,
	getBulkSimBaselineGear,
} from './types';

export const bulkSimStageConfigs: ConcurrentBulkSimStageConfig[] = BULK_SIM_STAGE_CONFIGS;

export const bulkSimFinalistStageConfig: ConcurrentBulkSimStageConfig = { stage: BulkSimStage.BulkSimStageFinalist, targetErrorPct: 0 };

// Scales the survivor cap for large candidate sets, mirroring
// getBulkSimStageMaxSurvivors in sim/core/bulk/stage.go. Returns undefined for
// uncapped stages.
export const getBulkSimStageMaxSurvivors = (config: ConcurrentBulkSimStageConfig, candidateCount: number): number | undefined => {
	if (config.maxSurvivors === undefined) return undefined;

	let scaleReference: number;
	switch (config.stage) {
		case BulkSimStage.BulkSimStageLow:
			scaleReference = BULK_SIM_LOW_STAGE_SURVIVOR_SCALE_REFERENCE;
			break;
		case BulkSimStage.BulkSimStageMedium:
			scaleReference = BULK_SIM_MEDIUM_STAGE_SURVIVOR_SCALE_REFERENCE;
			break;
		default:
			return config.maxSurvivors;
	}

	if (candidateCount <= scaleReference) return config.maxSurvivors;

	const scale = Math.sqrt(candidateCount / scaleReference);
	return Math.max(config.maxSurvivors, Math.ceil(config.maxSurvivors * scale));
};

export const shouldRunBulkSimStage = (config: ConcurrentBulkSimStageConfig, candidateCount: number): boolean => {
	const maxSurvivors = getBulkSimStageMaxSurvivors(config, candidateCount);
	return (
		maxSurvivors === undefined ||
		candidateCount > maxSurvivors ||
		(candidateCount < BULK_SIM_MIN_COMBINATIONS && config.stage == BulkSimStage.BulkSimStageHigh)
	);
};

export const getBulkSimStageMinIterations = (request: BulkSimRequest, config: ConcurrentBulkSimStageConfig): number => {
	if (config.stage == BulkSimStage.BulkSimStageHigh && request.highStageIterations > 0) {
		return request.highStageIterations;
	}
	return config.minIterations ?? request.highStageIterations;
};

const getBulkSimStageIterations = (
	request: BulkSimRequest,
	config: ConcurrentBulkSimStageConfig,
	baselineMetrics: DistributionMetrics | undefined,
	candidateCount: number,
): number => {
	const minIterations = getBulkSimStageMinIterations(request, config);
	const targetIterations = getBulkSimTargetIterations(config.targetErrorPct, baselineMetrics, candidateCount);
	return Math.max(minIterations, targetIterations);
};

// Runs `iterations` of the baseline gear at `seedOffset` and folds the result into
// `carried` (undefined when there is nothing carried yet). Progress is reported as
// completedSimsBase sims done plus this segment's iterations on top of
// completedIterationsBase. An errored segment is returned as-is for the caller to check.
const runBulkSimBaselineSegment = async (
	request: BulkSimRequest,
	carried: ConcurrentBulkSimCandidateResult | undefined,
	iterations: number,
	seedOffset: number,
	workerPool: WorkerPool,
	emitter: BulkSimStageProgressEmitter,
	completedSimsBase: number,
	completedIterationsBase: number,
	signals: SimSignals,
): Promise<ConcurrentBulkSimCandidateResult> => {
	const segment = await runSingleBulkSimCandidate(
		request,
		{ index: -1, gear: getBulkSimBaselineGear(request) },
		iterations,
		workerPool,
		signals,
		BulkSimCandidateTransport.SplitAcrossWorkers,
		progressMetrics => {
			if (progressMetrics.totalIterations == 0) return;
			emitter.report(completedSimsBase, completedIterationsBase + Math.min(progressMetrics.completedIterations, iterations), progressMetrics.dps);
		},
		seedOffset,
	);
	if (segment.error) return segment;
	return mergeBulkSimCandidateResults(carried, segment);
};

const adaptConcurrentBulkSimStageIterations = async (
	request: BulkSimRequest,
	candidates: ConcurrentBulkSimCandidate[],
	config: ConcurrentBulkSimStageConfig,
	workerPool: WorkerPool,
	onProgress: WorkerProgressCallback,
	signals: SimSignals,
	baseline: ConcurrentBulkSimCandidateResult,
	results: ConcurrentBulkSimCandidateResult[],
	iterations: number,
): Promise<{ baseline: ConcurrentBulkSimCandidateResult; results: ConcurrentBulkSimCandidateResult[]; iterations: number }> => {
	const maxAdaptiveIterations = Math.ceil(iterations * BULK_SIM_ADAPTIVE_MAX_ITERATION_MULTIPLIER);
	for (let adaptivePass = 1; adaptivePass <= BULK_SIM_MAX_ADAPTIVE_PASSES; adaptivePass++) {
		if (signals.abort.isTriggered() || hasBulkSimStageError(baseline, results)) return { baseline, results, iterations };

		const observedErrorPct = bulkSimObservedStageErrorPct(baseline, results, iterations, candidates.length);
		if (observedErrorPct <= config.targetErrorPct) return { baseline, results, iterations };

		let targetIterations = getBulkSimStageTargetIterations(config.targetErrorPct, baseline, results, candidates.length);
		targetIterations = Math.min(maxAdaptiveIterations, Math.max(iterations + 1, targetIterations));
		if (targetIterations <= iterations) return { baseline, results, iterations };

		if (isDevMode()) {
			console.log(`[Bulk Sim] - Stage: ${bulkSimStageLogName(config.stage)} - Adaptive pass ${adaptivePass}
Results:
  Current iterations: ${iterations}
  Additional iterations: ${targetIterations - iterations}
  Target iterations: ${targetIterations}
  Target error: ${config.targetErrorPct.toFixed(2)}%
  Observed error: ${observedErrorPct.toFixed(2)}%`);
		}

		const additionalIterations = targetIterations - iterations;
		const rerunResult = await rerunConcurrentBulkSimStageAdditionalIterations(
			request,
			candidates,
			config,
			workerPool,
			onProgress,
			signals,
			baseline,
			results,
			iterations,
			additionalIterations,
		);
		baseline = rerunResult.baseline;
		results = rerunResult.results;
		iterations = targetIterations;
	}
	return { baseline, results, iterations };
};

const rerunConcurrentBulkSimStageAdditionalIterations = async (
	request: BulkSimRequest,
	candidates: ConcurrentBulkSimCandidate[],
	config: ConcurrentBulkSimStageConfig,
	workerPool: WorkerPool,
	onProgress: WorkerProgressCallback,
	signals: SimSignals,
	baseline: ConcurrentBulkSimCandidateResult,
	results: ConcurrentBulkSimCandidateResult[],
	currentIterations: number,
	additionalIterations: number,
): Promise<{ baseline: ConcurrentBulkSimCandidateResult; results: ConcurrentBulkSimCandidateResult[] }> => {
	const totalSims = candidates.length + 1;
	const emitter = makeBulkSimStageProgressEmitter(onProgress, config.stage, totalSims, totalSims * additionalIterations);
	emitter.report(0, 0, 0);

	const baselineExtra = await runBulkSimBaselineSegment(request, baseline, additionalIterations, currentIterations, workerPool, emitter, 0, 0, signals);
	if (baselineExtra.error) return { baseline: baselineExtra, results };
	baseline = baselineExtra;
	emitter.report(1, additionalIterations, baseline.dpsMetrics?.avg ?? 0);

	const additionalResults = await runBulkSimCandidateBatchOnWorkers(request, candidates, additionalIterations, workerPool, signals, {
		completedSimsBase: 1,
		completedIterationsBase: additionalIterations,
		emitter,
		seedOffset: currentIterations,
	});

	return { baseline, results: mergeBulkSimCandidateResultSlices(results, additionalResults) };
};

// A stage that could not produce results: the metrics carry only the stage id, since
// nothing was measured.
const bulkSimStageError = (
	config: ConcurrentBulkSimStageConfig,
	baseline: ConcurrentBulkSimCandidateResult,
	iterations: number,
): ConcurrentBulkSimStageResult => ({
	baseline,
	results: [],
	iterations,
	metrics: BulkSimStageMetrics.create({ stage: config.stage }),
});

const buildBulkSimStageMetrics = (
	config: ConcurrentBulkSimStageConfig,
	candidates: ConcurrentBulkSimCandidate[],
	results: ConcurrentBulkSimCandidateResult[],
	baseline: ConcurrentBulkSimCandidateResult,
	iterations: number,
	concurrency: number,
	startedAt: number,
): BulkSimStageMetrics =>
	BulkSimStageMetrics.create({
		stage: config.stage,
		inputGearSets: candidates.length,
		survivors: results.length,
		iterations,
		concurrency,
		durationSeconds: (new Date().getTime() - startedAt) / 1000,
		targetErrorPct: config.targetErrorPct,
		observedErrorPct: bulkSimObservedStageErrorPct(baseline, results, iterations, candidates.length),
		baselineAvgDps: baseline.dpsMetrics?.avg ?? 0,
		bestCandidateAvgDps: results.reduce((best, result) => Math.max(best, result.dpsMetrics?.avg ?? 0), 0),
	});

// Iterations already simmed by the previous stage are carried over instead of being
// re-run: the stage only sims the delta with a seed offset and merges. That is exactly
// equivalent to running the full count from scratch, because iteration N always uses
// seed randomSeed+N.
export const runConcurrentBulkSimStage = async (
	request: BulkSimRequest,
	candidates: ConcurrentBulkSimCandidate[],
	config: ConcurrentBulkSimStageConfig,
	workerPool: WorkerPool,
	onProgress: WorkerProgressCallback,
	signals: SimSignals,
	carryOver?: ConcurrentBulkSimStageCarryOver,
): Promise<ConcurrentBulkSimStageResult> => {
	const startedAt = new Date().getTime();
	const minIterations = getBulkSimStageMinIterations(request, config);
	const carry = bulkSimCarryOverCovers(carryOver, candidates) ? carryOver : undefined;
	const carriedIterations = carry?.iterations ?? 0;
	const concurrency = Math.min(workerPool.getNumWorkers(), candidates.length);
	if (isDevMode()) {
		console.log(`[Bulk Sim] ${formatBulkSimStageStart(config, candidates.length, minIterations, carriedIterations)}`);
	}
	const maxBaselineSims = 2;
	const maxTotalSims = candidates.length + maxBaselineSims;
	const probeDelta = Math.max(0, minIterations - carriedIterations);
	const probeEmitter = makeBulkSimStageProgressEmitter(onProgress, config.stage, maxTotalSims, maxTotalSims * probeDelta);
	probeEmitter.report(0, 0, 0);

	const baselineCandidate = { index: -1, gear: getBulkSimBaselineGear(request) };
	let baselineProbe = carry?.baseline;
	let probeIterations = carriedIterations;
	if (probeDelta > 0) {
		baselineProbe = await runBulkSimBaselineSegment(request, baselineProbe, probeDelta, carriedIterations, workerPool, probeEmitter, 0, 0, signals);
		if (baselineProbe.error) {
			return bulkSimStageError(config, baselineProbe, minIterations);
		}
		probeIterations = minIterations;
	}
	// probeDelta is only 0 when the carried iterations already cover the stage minimum,
	// which implies a carried baseline. Guard anyway rather than risk a crash mid-run.
	if (!baselineProbe) {
		const error = ErrorOutcome.create({ message: '[Bulk sim] Stage has no baseline probe' });
		return bulkSimStageError(config, { candidate: baselineCandidate, error }, minIterations);
	}
	probeEmitter.report(1, probeDelta, baselineProbe.dpsMetrics?.avg ?? 0);

	const iterations = Math.max(getBulkSimStageIterations(request, config, baselineProbe.dpsMetrics, candidates.length), probeIterations);
	const baselineDelta = iterations - probeIterations;
	const candidateDelta = iterations - carriedIterations;
	const probeSims = probeDelta > 0 ? 1 : 0;
	const baselineSims = probeSims + (baselineDelta > 0 ? 1 : 0);
	const candidateSims = candidateDelta > 0 ? candidates.length : 0;
	const totalSims = candidateSims + baselineSims;
	let completedBaselineIterations = probeDelta;
	let baseline = baselineProbe;
	const emitter = makeBulkSimStageProgressEmitter(onProgress, config.stage, totalSims, candidateSims * candidateDelta + probeDelta + baselineDelta);
	emitter.report(probeSims, completedBaselineIterations, baselineProbe.dpsMetrics?.avg ?? 0);

	if (baselineDelta > 0) {
		baseline = await runBulkSimBaselineSegment(request, baselineProbe, baselineDelta, probeIterations, workerPool, emitter, probeSims, probeDelta, signals);
		if (baseline.error) {
			return bulkSimStageError(config, baseline, iterations);
		}
		completedBaselineIterations = probeDelta + baselineDelta;
		emitter.report(baselineSims, completedBaselineIterations, baseline.dpsMetrics?.avg ?? 0);
	}

	// Everything this stage needs is already covered by the carried iterations.
	if (candidateDelta <= 0) {
		const carriedResults = bulkSimCarriedResults(carry, candidates);
		return {
			baseline,
			results: carriedResults,
			iterations,
			metrics: buildBulkSimStageMetrics(config, candidates, carriedResults, baseline, iterations, concurrency, startedAt),
		};
	}

	const results = await runBulkSimCandidateBatchOnWorkers(
		request,
		candidates,
		candidateDelta,
		workerPool,
		signals,
		{
			completedSimsBase: baselineSims,
			completedIterationsBase: completedBaselineIterations,
			emitter,
			seedOffset: carriedIterations,
		},
		carry?.byCandidate,
	);
	const adaptedStage = await adaptConcurrentBulkSimStageIterations(
		request,
		candidates,
		config,
		workerPool,
		onProgress,
		signals,
		baseline,
		results,
		iterations,
	);
	baseline = adaptedStage.baseline;
	// Only a rerun produces a fresh array; every other path returns the one passed in, so
	// the common case would copy every element onto itself. Replace in place (the callers
	// below hold this reference) by assignment rather than a spread: the low stage runs on
	// the full candidate list, and one argument per candidate throws RangeError past the
	// engine's argument limit.
	if (adaptedStage.results !== results) {
		for (let i = 0; i < adaptedStage.results.length; i++) {
			results[i] = adaptedStage.results[i];
		}
		results.length = adaptedStage.results.length;
	}
	if (baseline.error) {
		return { ...bulkSimStageError(config, baseline, adaptedStage.iterations), results };
	}

	return {
		baseline,
		results,
		iterations: adaptedStage.iterations,
		metrics: buildBulkSimStageMetrics(config, candidates, results, baseline, adaptedStage.iterations, concurrency, startedAt),
	};
};

// Mirrors runBulkSimFinalistStage in sim/core/bulk/stage.go: adds lockstep iterations to the
// displayed top results (and the baseline) until every adjacent pair of the final ranking is
// statistically separated or the extra-iteration budget is spent, so near-ties do not flip
// order between runs with different seeds. When the stage runs, the returned results are the
// refined, DPS-sorted finalists - they ARE the displayed set.
export const runConcurrentBulkSimFinalistStage = async (
	request: BulkSimRequest,
	baseline: ConcurrentBulkSimCandidateResult,
	results: ConcurrentBulkSimCandidateResult[],
	topResults: number,
	workerPool: WorkerPool,
	onProgress: WorkerProgressCallback,
	signals: SimSignals,
): Promise<{ baseline: ConcurrentBulkSimCandidateResult; results: ConcurrentBulkSimCandidateResult[]; metrics?: BulkSimStageMetrics }> => {
	let finalists = topBulkSimResults(results, topResults);
	if (finalists.length < 2 || !baseline.dpsMetrics) return { baseline, results };

	// Total iterations run so far comes from the paired value arrays themselves, which also
	// makes the lockstep precondition explicit: every finalist and the baseline must carry
	// the same number of per-iteration values or pairing (and this stage) cannot help.
	const iterations = baseline.dpsMetrics.allValues.length;
	if (iterations === 0 || finalists.some(finalist => (finalist.dpsMetrics?.allValues.length ?? 0) !== iterations)) {
		return { baseline, results };
	}
	if (!bulkSimUnresolvedFinalistPair(finalists)) return { baseline, results };

	const startedAt = new Date().getTime();
	const config = bulkSimFinalistStageConfig;
	const candidates = finalists.map(finalist => finalist.candidate);
	const concurrency = Math.min(workerPool.getNumWorkers(), candidates.length);
	if (isDevMode()) {
		console.log(`[Bulk Sim] - Stage: ${bulkSimStageLogName(config.stage)} - Started finalists=${finalists.length} iterations=${iterations}`);
	}

	const extraBudget = iterations * BULK_SIM_FINALIST_MAX_EXTRA_ITERATION_MULTIPLIER;
	let extraUsed = 0;
	while (extraUsed < extraBudget && bulkSimUnresolvedFinalistPair(finalists)) {
		if (signals.abort.isTriggered() || hasBulkSimStageError(baseline, finalists)) break;
		// Double the sample each round: the paired error shrinks with sqrt(n), so smaller
		// steps mostly re-discover that the pair is still unresolved.
		const additionalIterations = Math.min(iterations + extraUsed, extraBudget - extraUsed);
		const rerunResult = await rerunConcurrentBulkSimStageAdditionalIterations(
			request,
			candidates,
			config,
			workerPool,
			onProgress,
			signals,
			baseline,
			finalists,
			iterations + extraUsed,
			additionalIterations,
		);
		baseline = rerunResult.baseline;
		finalists = topBulkSimResults(rerunResult.results, rerunResult.results.length);
		extraUsed += additionalIterations;
	}

	const metrics = buildBulkSimStageMetrics(config, candidates, finalists, baseline, iterations + extraUsed, concurrency, startedAt);
	if (isDevMode()) {
		console.log(`[Bulk Sim] ${formatBulkSimStageSummary('Finished', metrics, finalists.length)}`);
	}
	return { baseline, results: finalists, metrics };
};
