import { BulkSimRequest, ErrorOutcome, ErrorOutcomeType, ProgressMetrics, RaidSimRequest, RaidSimResult } from '@generated/proto/api';
import { queue } from 'async';

import { SimSignals } from '../../sim_signal_manager';
import { noop } from '../../utils';
import { WorkerPool } from '../../worker_pool';
import { runConcurrentSim } from '../sim';
import { cleanBulkSimDpsMetrics, mergeBulkSimCandidateResults } from './merge';
import { BulkSimStageProgressEmitter } from './progress';
import { ConcurrentBulkSimCandidate, ConcurrentBulkSimCandidateResult, ConcurrentBulkSimCandidateTask } from './types';

type ConcurrentBulkSimCandidateBatchConfig = {
	completedSimsBase: number;
	completedIterationsBase: number;
	emitter: BulkSimStageProgressEmitter;
	seedOffset: number;
};

const makeBulkSimRequestForCandidate = (
	request: BulkSimRequest,
	candidate: ConcurrentBulkSimCandidate,
	iterations: number,
	seedOffset = 0,
	scratch?: RaidSimRequest,
): RaidSimRequest => {
	// The scratch request avoids one full clone of the raid + rotation + merged SimDatabase
	// per candidate. Reuse is safe because the caller mutates and serializes it within one
	// synchronous window (worker requests encode to binary before the first await).
	const simRequest = scratch ?? RaidSimRequest.clone(request.baseRequest!);
	simRequest.requestId = request.requestId;
	simRequest.simOptions!.iterations = iterations;
	simRequest.simOptions!.randomSeed = request.baseRequest!.simOptions!.randomSeed + BigInt(seedOffset);
	simRequest.simOptions!.debugFirstIteration = false;
	simRequest.simOptions!.debug = false;
	// Every candidate runs the same seed sequence, so keeping the per-iteration values
	// lets culling compare paired differences instead of marginal errors.
	simRequest.simOptions!.saveAllValues = true;
	simRequest.raid!.parties[0].players[0].equipment = candidate.gear;
	return simRequest;
};

export enum BulkSimCandidateTransport {
	// Spreads one gear set's iterations across every worker. Used for the baseline,
	// which has no siblings to run alongside it.
	SplitAcrossWorkers = 'SplitAcrossWorkers',
	// Keeps a gear set on a single worker. Used by the candidate batch, which saturates
	// the pool with candidates instead.
	SingleWorker = 'SingleWorker',
}

export const runSingleBulkSimCandidate = async (
	request: BulkSimRequest,
	candidate: ConcurrentBulkSimCandidate,
	iterations: number,
	workerPool: WorkerPool,
	signals: SimSignals,
	transport: BulkSimCandidateTransport,
	progressCallback?: (progressMetrics: ProgressMetrics) => void,
	seedOffset = 0,
	scratchRequest?: RaidSimRequest,
): Promise<ConcurrentBulkSimCandidateResult> => {
	if (signals.abort.isTriggered()) {
		return { candidate, error: ErrorOutcome.create({ type: ErrorOutcomeType.ErrorOutcomeAborted }) };
	}

	const simRequest = makeBulkSimRequestForCandidate(request, candidate, iterations, seedOffset, scratchRequest);
	let simResult: RaidSimResult;
	if (transport === BulkSimCandidateTransport.SplitAcrossWorkers) {
		simResult = await runConcurrentSim(simRequest, workerPool, progressCallback ?? noop, signals);
	} else {
		simRequest.requestId = `${request.requestId}-${candidate.index}-${seedOffset}`;
		simResult = await workerPool.raidSimAsync(simRequest, progressCallback ?? noop, signals);
	}
	if (simResult.error) {
		return { candidate, error: simResult.error };
	}

	return {
		candidate,
		dpsMetrics: cleanBulkSimDpsMetrics(simResult.raidMetrics?.dps),
	};
};

export const runBulkSimCandidateBatchOnWorkers = async (
	request: BulkSimRequest,
	candidates: ConcurrentBulkSimCandidate[],
	iterations: number,
	workerPool: WorkerPool,
	signals: SimSignals,
	batchConfig: ConcurrentBulkSimCandidateBatchConfig,
	carriedByCandidate?: Map<number, ConcurrentBulkSimCandidateResult>,
): Promise<ConcurrentBulkSimCandidateResult[]> => {
	const candidateIterationsDone = Array(candidates.length).fill(0);
	const results: Array<ConcurrentBulkSimCandidateResult | undefined> = [];
	const concurrency = Math.max(1, Math.min(workerPool.getNumWorkers(), candidates.length));
	let completedCandidates = 0;
	let completedCandidateIterations = 0;

	const updateCandidateIterations = (idx: number, completedIterations: number) => {
		const nextCompletedIterations = Math.min(completedIterations, iterations);
		completedCandidateIterations += nextCompletedIterations - candidateIterationsDone[idx];
		candidateIterationsDone[idx] = nextCompletedIterations;
	};

	// One scratch request shared by all queue tasks: each task mutates and serializes it in
	// one synchronous window, so tasks never observe each other's mutations.
	const scratchRequest = RaidSimRequest.clone(request.baseRequest!);
	const candidateQueue = queue<ConcurrentBulkSimCandidateTask, Error>(async ({ candidate, idx }) => {
		if (signals.abort.isTriggered()) return;

		const deltaResult = await runSingleBulkSimCandidate(
			request,
			candidate,
			iterations,
			workerPool,
			signals,
			BulkSimCandidateTransport.SingleWorker,
			progressMetrics => {
				if (progressMetrics.totalIterations == 0) return;
				updateCandidateIterations(idx, progressMetrics.completedIterations);
				batchConfig.emitter.report(
					batchConfig.completedSimsBase + completedCandidates,
					batchConfig.completedIterationsBase + completedCandidateIterations,
					progressMetrics.dps,
				);
			},
			batchConfig.seedOffset,
			scratchRequest,
		);

		// Fold in the iterations carried over from the previous stage before reporting, so
		// progress shows the merged average rather than the delta run's average.
		const candidateResult = mergeBulkSimCandidateResults(carriedByCandidate?.get(candidate.index), deltaResult);

		updateCandidateIterations(idx, iterations);
		completedCandidates++;
		batchConfig.emitter.report(
			batchConfig.completedSimsBase + completedCandidates,
			batchConfig.completedIterationsBase + completedCandidateIterations,
			candidateResult.dpsMetrics?.avg ?? 0,
		);

		if (candidateResult.error) {
			signals.abort.trigger();
		}
		results[idx] = candidateResult;
	}, concurrency);

	const queueErrorPromise = candidateQueue.error();
	candidates.forEach((candidate, idx) => candidateQueue.push({ candidate, idx }));
	await Promise.race([candidateQueue.drain(), queueErrorPromise]);
	return results.filter((result): result is ConcurrentBulkSimCandidateResult => !!result);
};
