import { BulkSimProgressConfig, TopGearResult } from '@domain/bulk/types';
import { BulkSimReforgeCacheProgress, bulkSimStageToOptimisationStage, cleanBulkDpsMetrics, getCoreBulkSimTrackingMetrics } from '@domain/bulk/utils';
import { Gear } from '@domain/proto_utils/gear';
import { ReforgeOptimizeConfig } from '@domain/sim';
import type { IndividualSimHost } from '@features/sim_host';
import { BulkSettings, DistributionMetrics, ProgressMetrics } from '@generated/proto/api';
import i18n from '@i18n/config';

export interface CoreBulkSimContext {
	simUI: IndividualSimHost<any>;
	throwIfBulkAborted: (signal: AbortSignal) => void;
	runWithBulkAbort: <T>(promise: Promise<T>, signal: AbortSignal) => Promise<T>;
	setSimProgress: (progress: ProgressMetrics, config: BulkSimProgressConfig) => void;
	setCacheRestoreProgress?: (progress: BulkSimReforgeCacheProgress) => void;
	debugOptimisationRound: (message: string, data?: unknown) => void;
}

export async function runCoreBulkSim(
	context: CoreBulkSimContext,
	gearSets: Gear[],
	signal: AbortSignal,
	reforgeConfig?: ReforgeOptimizeConfig,
	bulkSettings?: BulkSettings,
): Promise<{ referenceDpsMetrics: DistributionMetrics; topGearResults: TopGearResult[]; metrics: Record<string, string | number> }> {
	context.throwIfBulkAborted(signal);
	context.debugOptimisationRound('core bulk sim started', {
		gearSets: gearSets.length,
	});

	let currentProgressStage: ProgressMetrics['bulkStage'] | undefined;
	let currentProgressStageStartedAt = new Date().getTime();
	const updateProgress = (progress: ProgressMetrics) => {
		if (progress.totalIterations <= 0) return;
		if (progress.bulkStage !== currentProgressStage) {
			currentProgressStage = progress.bulkStage;
			currentProgressStageStartedAt = new Date().getTime();
		}

		const stageName = bulkSimStageToOptimisationStage(progress.bulkStage);
		context.setSimProgress(progress, {
			currentRound: 1,
			totalRounds: 1,
			title: stageName ? i18n.t(`bulk_tab.progress.${stageName}_iteration_rounds`) : i18n.t('bulk_tab.progress.refining_rounds'),
			aggregateStartedAt: currentProgressStageStartedAt,
			useSimCountProgress: true,
		});
	};

	const result = await context.runWithBulkAbort(
		context.simUI.sim.runBulkSim(gearSets, updateProgress, reforgeConfig, bulkSettings, progress => context.setCacheRestoreProgress?.(progress), signal),
		signal,
	);
	if (!result || (result && 'type' in result)) {
		throw new Error(result?.message);
	}
	if (!result.baseline?.dpsMetrics) {
		throw new Error('Bulk sim did not return baseline results.');
	}

	const topGearResults = result.topResults
		.filter(topResult => topResult.gear && topResult.dpsMetrics)
		.map((topResult, backendRank) => ({
			gear: context.simUI.sim.db.lookupEquipmentSpec(topResult.gear!),
			dpsMetrics: cleanBulkDpsMetrics(topResult.dpsMetrics!),
			backendRank,
			pairedErrorToNextResult: topResult.pairedErrorToNextResult,
			pairedErrorToBaseline: topResult.pairedErrorToBaseline,
		}));

	context.debugOptimisationRound('core bulk sim complete', {
		durationSeconds: result.timings?.totalSeconds ?? 0,
		gearSets: gearSets.length,
		stageMetrics: result.stageMetrics,
		topGearResults: topGearResults.map((topResult, index) => ({
			rank: index + 1,
			avg: topResult.dpsMetrics.avg,
			stdev: topResult.dpsMetrics.stdev,
		})),
	});

	return {
		referenceDpsMetrics: result.baseline.dpsMetrics,
		topGearResults,
		metrics: getCoreBulkSimTrackingMetrics(result),
	};
}
