import { BulkGearCandidate, BulkSimRequest, BulkSimResult, BulkSimStage, BulkSimTimings, ErrorOutcome, ErrorOutcomeType, ProgressMetrics } from '../../proto/api';
import { EquipmentSpec } from '../../proto/common';
import { SimSignals } from '../../sim_signal_manager';
import { isDevMode } from '../../utils';
import { WorkerPool, WorkerProgressCallback } from '../../worker_pool';
import { BulkSimCandidateTransport, runSingleBulkSimCandidate } from './batch';
import { ConcurrentBulkSimStageCarryOver, newBulkSimStageCarryOver } from './carry_over';
import { BULK_SIM_DEFAULT_TOP_RESULTS } from './constants_auto_gen';
import { shouldUseLegacyBulkSim } from './estimate';
import { bulkSimCandidateResultToProto } from './merge';
import { formatBulkSimStageSummary } from './progress';
import { optimizeReforgeCandidates } from './reforge';
import { bulkSimStageConfigs, runConcurrentBulkSimFinalistStage, runConcurrentBulkSimStage, shouldRunBulkSimStage } from './stage';
import { bulkSimPairedDpsError, selectBulkSimSurvivors, topBulkSimResults } from './statistics';
import { ConcurrentBulkSimCandidateResult, getBulkSimBaselineGear } from './types';

const makeAndSendBulkSimError = (
	err: string | ErrorOutcome,
	onProgress: WorkerProgressCallback,
	optimizedCandidates: BulkGearCandidate[] = [],
): BulkSimResult => {
	const errRes = BulkSimResult.create();
	errRes.optimizedCandidates = optimizedCandidates.map(candidate => BulkGearCandidate.clone(candidate));
	if (typeof err === 'string') {
		console.error(err);
		errRes.error = ErrorOutcome.create({ message: err });
	} else {
		if (err.message) console.error(err.message);
		errRes.error = err;
	}
	onProgress(ProgressMetrics.create({ bulkStage: BulkSimStage.BulkSimStageError, finalBulkSimResult: errRes }));
	return errRes;
};

const validateBulkSimRequest = (request: BulkSimRequest): string => {
	if (!request) return '[Bulk sim] Request is empty';
	if (!request.baseRequest) return '[Bulk sim] Base request is empty';
	if (!request.baseRequest.raid) return '[Bulk sim] Raid is empty';
	if (!request.baseRequest.simOptions) return '[Bulk sim] Sim options are empty';
	const player = request.baseRequest.raid.parties[0]?.players[0];
	if (!player || !player.class) return '[Bulk Sim] First player is empty';
	if (!player.equipment) return '[Bulk sim] Baseline gear is empty';
	return '';
};

export const runConcurrentBulkSim = async (
	request: BulkSimRequest,
	workerPool: WorkerPool,
	onProgress: WorkerProgressCallback,
	signals: SimSignals,
	onReforgeCandidateOptimized?: (candidate: BulkGearCandidate, optimizedGear: EquipmentSpec) => void | Promise<void>,
): Promise<BulkSimResult> => {
	if (isDevMode()) {
		console.log(`Running bulk sim using ${workerPool.getNumWorkers()} wasm workers per gear sim.`);
	}

	const validationError = validateBulkSimRequest(request);
	if (validationError) return makeAndSendBulkSimError(validationError, onProgress);

	const startedAt = new Date().getTime();
	if (request.reforgeRequest) {
		const reforgeResult = await optimizeReforgeCandidates(request, workerPool, onProgress, signals, onReforgeCandidateOptimized);
		request = reforgeResult.request;
		if (reforgeResult.aborted) {
			return makeAndSendBulkSimError(ErrorOutcome.create({ type: ErrorOutcomeType.ErrorOutcomeAborted }), onProgress, request.optimizedCandidates);
		}
	}
	const simmingStartedAt = new Date().getTime();
	let candidates = request.candidates
		.filter(candidate => candidate.gear)
		.map((candidate: BulkGearCandidate) => ({ index: candidate.index, gear: candidate.gear! }));
	const topResults = request.topResults > 0 ? request.topResults : BULK_SIM_DEFAULT_TOP_RESULTS;
	const result = BulkSimResult.create({ timings: BulkSimTimings.create() });

	if (candidates.length == 0) {
		const baseline = await runSingleBulkSimCandidate(
			request,
			{ index: -1, gear: getBulkSimBaselineGear(request) },
			request.baseRequest!.simOptions!.iterations,
			workerPool,
			signals,
			BulkSimCandidateTransport.SplitAcrossWorkers,
		);
		if (baseline.error) return makeAndSendBulkSimError(baseline.error, onProgress);

		result.baseline = bulkSimCandidateResultToProto(baseline);
		result.timings!.totalSeconds = (new Date().getTime() - startedAt) / 1000;
		result.timings!.simmingSeconds = (new Date().getTime() - simmingStartedAt) / 1000;
		onProgress(ProgressMetrics.create({ bulkStage: BulkSimStage.BulkSimStageComplete, finalBulkSimResult: result }));
		return result;
	}

	let latestBaseline: ConcurrentBulkSimCandidateResult | undefined;
	let latestResults: ConcurrentBulkSimCandidateResult[] = [];
	let carry: ConcurrentBulkSimStageCarryOver | undefined;
	const useLegacyBulkSim = shouldUseLegacyBulkSim(request, candidates.length);
	// Culling intervals are corrected for how many candidates the run started with, not
	// for how many are left: the survivors were themselves selected by the same noisy
	// metric, so recomputing the correction on the shrinking set would weaken it exactly
	// as the decisions become final. Iteration targeting deliberately keeps using the
	// current stage's count - driving it from the original count inflates the final
	// stage's iterations (measured +17.6%) without changing which gear set wins.
	const originalCandidateCount = candidates.length;
	for (const stageConfig of bulkSimStageConfigs) {
		if (signals.abort.isTriggered()) return makeAndSendBulkSimError(ErrorOutcome.create({ type: ErrorOutcomeType.ErrorOutcomeAborted }), onProgress);
		if (useLegacyBulkSim && stageConfig.stage !== BulkSimStage.BulkSimStageHigh) continue;
		if (!shouldRunBulkSimStage(stageConfig, candidates.length)) continue;

		const stageResult = await runConcurrentBulkSimStage(request, candidates, stageConfig, workerPool, onProgress, signals, carry);
		if (stageResult.baseline?.error) return makeAndSendBulkSimError(stageResult.baseline.error, onProgress);
		const candidateError = stageResult.results.find(candidateResult => candidateResult.error)?.error;
		if (candidateError) return makeAndSendBulkSimError(candidateError, onProgress);

		latestBaseline = stageResult.baseline;
		latestResults = stageResult.results;
		carry = newBulkSimStageCarryOver(stageResult);
		result.stageMetrics.push(stageResult.metrics);
		switch (stageConfig.stage) {
			case BulkSimStage.BulkSimStageLow:
				result.timings!.lowStageSeconds = stageResult.metrics.durationSeconds;
				break;
			case BulkSimStage.BulkSimStageMedium:
				result.timings!.mediumStageSeconds = stageResult.metrics.durationSeconds;
				break;
			case BulkSimStage.BulkSimStageHigh:
				result.timings!.highStageSeconds = stageResult.metrics.durationSeconds;
				break;
		}

		if (stageConfig.maxSurvivors !== undefined && latestBaseline) {
			candidates = selectBulkSimSurvivors(stageResult.results, latestBaseline, stageResult.iterations, stageConfig, originalCandidateCount);
			stageResult.metrics.survivors = candidates.length;
		}
		if (isDevMode()) {
			console.log(`[Bulk Sim] ${formatBulkSimStageSummary('Finished', stageResult.metrics, stageResult.results.length)}`);
		}
	}

	// A cancel that lands after the last stage finished would otherwise be reported as a
	// completed run built from a partially simmed candidate set.
	if (signals.abort.isTriggered()) return makeAndSendBulkSimError(ErrorOutcome.create({ type: ErrorOutcomeType.ErrorOutcomeAborted }), onProgress);

	if (!latestBaseline) {
		latestBaseline = await runSingleBulkSimCandidate(
			request,
			{ index: -1, gear: getBulkSimBaselineGear(request) },
			request.baseRequest!.simOptions!.iterations,
			workerPool,
			signals,
			BulkSimCandidateTransport.SplitAcrossWorkers,
		);
		if (latestBaseline.error) return makeAndSendBulkSimError(latestBaseline.error, onProgress);
	}

	// Finalist refinement: add lockstep iterations to the displayed top results until their
	// ranking is statistically separated (or the budget runs out), so near-ties do not flip
	// order between runs with different seeds.
	const finalistResult = await runConcurrentBulkSimFinalistStage(request, latestBaseline, latestResults, topResults, workerPool, onProgress, signals);
	latestBaseline = finalistResult.baseline;
	latestResults = finalistResult.results;
	if (finalistResult.metrics) {
		result.stageMetrics.push(finalistResult.metrics);
		result.timings!.finalistStageSeconds = finalistResult.metrics.durationSeconds;
	}
	if (signals.abort.isTriggered()) return makeAndSendBulkSimError(ErrorOutcome.create({ type: ErrorOutcomeType.ErrorOutcomeAborted }), onProgress);

	result.baseline = bulkSimCandidateResultToProto(latestBaseline);
	// When the finalist stage ran, latestResults already IS the refined, sorted display set.
	const top = topBulkSimResults(latestResults, topResults);
	const finalBaseline = latestBaseline;
	result.topResults = top.flatMap((candidateResult, idx) => {
		const protoResult = bulkSimCandidateResultToProto(candidateResult);
		if (!protoResult) return [];
		if (idx + 1 < top.length) {
			protoResult.pairedErrorToNextResult = bulkSimPairedDpsError(top[idx + 1].dpsMetrics, candidateResult.dpsMetrics) ?? 0;
		}
		protoResult.pairedErrorToBaseline = bulkSimPairedDpsError(candidateResult.dpsMetrics, finalBaseline.dpsMetrics) ?? 0;
		return [protoResult];
	});
	result.timings!.simmingSeconds = (new Date().getTime() - simmingStartedAt) / 1000;
	result.timings!.totalSeconds = (new Date().getTime() - startedAt) / 1000;

	onProgress(ProgressMetrics.create({ bulkStage: BulkSimStage.BulkSimStageComplete, finalBulkSimResult: result }));
	return result;
};
