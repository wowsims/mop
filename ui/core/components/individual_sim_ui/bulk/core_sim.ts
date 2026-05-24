import i18n from '../../../../i18n/config';
import { IndividualSimUI } from '../../../individual_sim_ui';
import { DistributionMetrics, ProgressMetrics } from '../../../proto/api';
import { Gear } from '../../../proto_utils/gear';
import { ReforgeOptimizeConfig } from '../../../sim';
import { BulkSimProgressConfig, TopGearResult } from './types';
import { bulkSimStageToOptimisationStage, cleanBulkDpsMetrics, getCoreBulkSimTrackingMetrics } from './utils';

export interface CoreBulkSimContext {
	simUI: IndividualSimUI<any>;
	throwIfBulkAborted: (signal: AbortSignal) => void;
	runWithBulkAbort: <T>(promise: Promise<T>, signal: AbortSignal) => Promise<T>;
	setSimProgress: (progress: ProgressMetrics, config: BulkSimProgressConfig) => void;
	debugOptimisationRound: (message: string, data?: unknown) => void;
}

export async function runCoreBulkSim(
	context: CoreBulkSimContext,
	gearSets: Gear[],
	signal: AbortSignal,
	reforgeConfig?: ReforgeOptimizeConfig,
): Promise<{ referenceDpsMetrics: DistributionMetrics; topGearResults: TopGearResult[]; metrics: Record<string, string | number> }> {
	context.throwIfBulkAborted(signal);
	context.debugOptimisationRound('core bulk sim started', {
		gearSets: gearSets.length,
	});

	const updateProgress = (progress: ProgressMetrics) => {
		if (progress.totalIterations <= 0) return;

		const stageName = bulkSimStageToOptimisationStage(progress.bulkStage);
		context.setSimProgress(progress, {
			currentRound: 1,
			totalRounds: 1,
			title: stageName ? i18n.t(`bulk_tab.progress.${stageName}_iteration_rounds`) : i18n.t('bulk_tab.progress.refining_rounds'),
			useSimCountProgress: true,
		});
	};

	const result = await context.runWithBulkAbort(context.simUI.sim.runBulkSim(gearSets, updateProgress, reforgeConfig), signal);
	if (!result || (result && 'type' in result)) {
		throw new Error(result?.message);
	}
	if (!result.baseline?.dpsMetrics) {
		throw new Error('Bulk sim did not return baseline results.');
	}

	const topGearResults = result.topResults
		.filter(topResult => topResult.gear && topResult.dpsMetrics)
		.map(topResult => ({
			gear: context.simUI.sim.db.lookupEquipmentSpec(topResult.gear!),
			dpsMetrics: cleanBulkDpsMetrics(topResult.dpsMetrics!),
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
