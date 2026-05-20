import { queue } from 'async';
import i18n from '../../../../i18n/config';
import { trackEvent } from '../../../../tracking/utils';
import { RaidSimResult } from '../../../proto/api';
import { Gear } from '../../../proto_utils/gear';
import {
	BulkOptimisationStageMetrics,
	BulkOptimisationStageProgress,
	BulkOptimisationStageResult,
	BulkOptimisationStageTask,
	BulkSingleGearSimConfig,
	OptimisationStage,
	STAGE_CONFIG,
	TopGearResult,
} from './types';
import {
	cleanBulkDpsMetrics,
	getCombinationErrorMultiplier,
	getDurationSeconds,
	getOptimisationStageIterations,
	getOptimisationStageMinIterations,
	getOptimisationStageTrackingMetrics,
} from './utils';

export interface WasmBulkSimContext {
	originalGear: Gear | null;
	bulkSimUsesWasmConcurrency: boolean;
	throwIfBulkAborted: (signal: AbortSignal) => void;
	runWithBulkAbort: <T>(promise: Promise<T>, signal: AbortSignal) => Promise<T>;
	runSingleGearSim: (gear: Gear, config: BulkSingleGearSimConfig) => Promise<RaidSimResult>;
	debugOptimisationRound: (message: string, data?: unknown) => void;
	getOptimisationStageConcurrency: (stageName: OptimisationStage) => number;
}

export async function runOptimisationStage(
	context: WasmBulkSimContext,
	stageName: OptimisationStage,
	gearSets: Gear[],
	currentRound: number,
	totalRounds: number,
	signal: AbortSignal,
	highStageIterations: number,
): Promise<BulkOptimisationStageResult> {
	context.throwIfBulkAborted(signal);
	const originalGear = context.originalGear;
	if (!originalGear) {
		throw new Error('Bulk sim original gear is missing.');
	}

	const stageStartedAt = new Date().getTime();
	const baselineProbeIterations = getOptimisationStageMinIterations(stageName, highStageIterations);
	const stageConcurrency = context.getOptimisationStageConcurrency(stageName);
	const stageRounds = gearSets.length + 1;
	const title = i18n.t(`bulk_tab.progress.${stageName}_iteration_rounds`);
	context.debugOptimisationRound(`${stageName} stage started`, {
		stageName,
		durationSeconds: 0,
		baselineProbeIterations,
		gearSets: gearSets.length,
		stageConcurrency,
		stageRounds,
		startingRound: currentRound,
		totalSimRounds: totalRounds,
	});

	const baselineProbeStartedAt = new Date().getTime();
	const baselineProbeResult = await context.runWithBulkAbort(
		context.runSingleGearSim(originalGear, {
			currentRound,
			totalRounds,
			iterations: baselineProbeIterations,
			title,
			stageCurrentRound: 1,
			stageRounds,
		}),
		signal,
	);
	const baselineProbeMetrics = baselineProbeResult!.raidMetrics!.dps!;
	const iterations = getOptimisationStageIterations(stageName, baselineProbeMetrics, gearSets.length, highStageIterations);
	const combinationErrorMultiplier = getCombinationErrorMultiplier(gearSets.length);
	context.debugOptimisationRound(`${stageName} iterations selected`, {
		stageName,
		stageElapsedSeconds: getDurationSeconds(stageStartedAt),
		baselineProbeDurationSeconds: getDurationSeconds(baselineProbeStartedAt),
		baselineProbeIterations,
		iterations,
		targetErrorPct: STAGE_CONFIG[stageName].targetErrorPct,
		combinationErrorMultiplier,
		baselineAvg: baselineProbeMetrics.avg,
		baselineStdev: baselineProbeMetrics.stdev,
	});

	const aggregateProgress: BulkOptimisationStageProgress = {
		completedIterationsByRound: new Map<number, number>(),
		completedIterations: 0,
		totalIterations: stageRounds * iterations,
		startedAt: new Date().getTime(),
	};

	const baselineStartedAt = new Date().getTime();
	const baselineResult = await context.runWithBulkAbort(
		context.runSingleGearSim(originalGear, {
			currentRound: currentRound++,
			totalRounds,
			iterations,
			title,
			stageCurrentRound: 1,
			stageRounds,
			aggregateProgress,
		}),
		signal,
	);
	const baseline: TopGearResult = {
		gear: originalGear,
		dpsMetrics: baselineResult!.raidMetrics!.dps!,
	};
	context.debugOptimisationRound(`${stageName} baseline complete`, {
		stageName,
		stageElapsedSeconds: getDurationSeconds(stageStartedAt),
		baselineDurationSeconds: getDurationSeconds(baselineStartedAt),
		iterations,
		avg: baseline.dpsMetrics.avg,
		stdev: baseline.dpsMetrics.stdev,
	});

	const results: TopGearResult[] = [];
	const candidateSimsStartedAt = new Date().getTime();
	const simQueue = queue<BulkOptimisationStageTask, Error>(async task => {
		context.throwIfBulkAborted(signal);
		const simResult = await context.runWithBulkAbort(
			context.runSingleGearSim(task.gear, {
				currentRound: task.round,
				totalRounds,
				iterations,
				title,
				stageCurrentRound: task.stageRound,
				stageRounds,
				aggregateProgress,
			}),
			signal,
		);
		if (!originalGear.equals(task.gear)) {
			results.push({
				gear: task.gear,
				dpsMetrics: cleanBulkDpsMetrics(simResult!.raidMetrics!.dps!),
			});
		}
	}, stageConcurrency);

	const queueErrorPromise = simQueue.error();
	for (const [idx, gear] of gearSets.entries()) {
		context.throwIfBulkAborted(signal);
		simQueue.push({ gear, round: currentRound++, stageRound: idx + 2 });
	}

	try {
		await Promise.race([simQueue.drain(), queueErrorPromise]);
	} catch (error) {
		simQueue.kill();
		throw error;
	}

	const bestCandidate = results.slice().sort((a, b) => b.dpsMetrics.avg - a.dpsMetrics.avg)[0];
	const stageDurationSeconds = getDurationSeconds(stageStartedAt);
	context.debugOptimisationRound(`${stageName} stage complete`, {
		stageName,
		durationSeconds: stageDurationSeconds,
		candidateSimDurationSeconds: getDurationSeconds(candidateSimsStartedAt),
		iterations,
		gearSets: gearSets.length,
		stageConcurrency,
		results: results.length,
		endingRound: currentRound - 1,
		totalSimRounds: totalRounds,
		bestCandidateAvg: bestCandidate?.dpsMetrics.avg,
		bestCandidateStdev: bestCandidate?.dpsMetrics.stdev,
	});

	const metrics: BulkOptimisationStageMetrics = {
		inputGearSets: gearSets.length,
		results: results.length,
		iterations,
		targetErrorPct: STAGE_CONFIG[stageName].targetErrorPct,
		combinationErrorMultiplier,
		concurrency: stageConcurrency,
		stageRounds,
		durationSeconds: stageDurationSeconds,
		baselineAvgDps: baseline.dpsMetrics.avg,
		baselineStdev: baseline.dpsMetrics.stdev,
		bestCandidateAvgDps: bestCandidate?.dpsMetrics.avg ?? 0,
		bestCandidateStdev: bestCandidate?.dpsMetrics.stdev ?? 0,
	};

	trackEvent({
		action: 'sim',
		category: 'batch_sim',
		label: `${stageName}_stage_complete`,
		value: Math.round(metrics.durationSeconds),
		additionalData: getOptimisationStageTrackingMetrics(stageName, metrics),
	});

	return {
		baseline,
		results,
		nextRound: currentRound,
		metrics,
	};
}
