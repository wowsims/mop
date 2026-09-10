import './EpWeightsDialog.scss';

import { ErrorOutcomeType, type StatWeightsResult } from '@generated/proto/api';
import { Stat } from '@generated/proto/common';
import i18n from '@i18n/config';
import { useSimHost } from '@sim/context/SimHostContext';
import { useDisplayMetrics } from '@sim/hooks/useDisplayMetrics';
import { useStatWeights } from '@sim/hooks/useStatWeights';
import { useStoreSubscribe } from '@sim/hooks/useStoreSubscribe';
import { Stats } from '@sim/proto/stats';
import type { StatWeightActionSettings } from '@sim/settings/stat_weight_settings';
import { subscribePlayerField, subscribeUiField } from '@sim/state/subscriptions';
import { Button } from '@ui-kit/Button';
import { Dialog } from '@ui-kit/Dialog';
import { Icon } from '@ui-kit/Icon';
import { ProgressTrackerDialog, type ProgressTrackerHandle, type ProgressTrackerState } from '@ui-kit/ProgressTrackerDialog';
import { toastManager } from '@ui-kit/Toast';
import { Tooltip } from '@ui-kit/Tooltip';
import { useCallback, useMemo, useRef, useState } from 'react';

import { trackEvent } from '../../../../tracking/analytics';
import { calculateEp, combineScaledEpValues, combineScaledWeights, emptyStatWeightsResult, epWeightsWithoutExcluded } from '../../model/ep_math';
import { visibleEpUnitStats } from '../../model/ep_unit_stats';
import { statsTableColumns } from '../../model/stats_table';
import { SavedEpWeights } from '../SavedEpWeights';
import { EpReferenceOptions } from './EpReferenceOptions';
import { EpWeightsOptions } from './EpWeightsOptions';
import { EpWeightsTable } from './EpWeightsTable';
import { StatsType } from './types';
import { buildEpColumns, EP_TOOLTIP_ID } from './utils';

export interface EpWeightsDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	settings: StatWeightActionSettings;
}

export const EpWeightsDialog = ({ open, onOpenChange, settings }: EpWeightsDialogProps) => {
	const host = useSimHost();
	const { player, sim, individualConfig } = host;

	const epStats = individualConfig.epStats;
	const epReferenceStat = individualConfig.epReferenceStat;
	const epPseudoStats = useMemo(() => individualConfig.epPseudoStats || [], [individualConfig]);
	const epStatSet = useMemo(() => ({ epStats, epPseudoStats }), [epStats, epPseudoStats]);

	const [statsType, setStatsType] = useState<StatsType>(StatsType.Ep);
	const [showAllStats, setShowAllStats] = useState(false);
	const [iterations, setIterations] = useState(0);
	const [simResult, setSimResult] = useState<StatWeightsResult | null>(null);
	const [progress, setProgress] = useState<ProgressTrackerState>({ stage: 'initializing' });
	const progressRef = useRef<ProgressTrackerHandle>(null);
	const {
		isRunning,
		isAborting,
		abort,
		start: startStatWeights,
	} = useStatWeights({
		onProgress: metrics =>
			progressRef.current?.setProgress({
				title: `${metrics.completedSims} / ${metrics.totalSims} ${i18n.t('sidebar.buttons.stat_weights.modal.progress.simulations_complete')}`,
				current: metrics.completedIterations,
				total: metrics.totalIterations,
			}),
	});

	const { threat: showThreatMetrics } = useDisplayMetrics(sim);
	const refStats = useStoreSubscribe(
		useMemo(() => subscribePlayerField(player, 'epRefStat'), [player]),
		() => ({ dps: player.getRefStat('dpsRefStat'), heal: player.getRefStat('healRefStat'), tank: player.getRefStat('tankRefStat') }),
	);
	const epRatios = useStoreSubscribe(
		useMemo(() => subscribePlayerField(player, 'epRatios'), [player]),
		() => player.getEpRatios(),
	);
	const epWeights = useStoreSubscribe(
		useMemo(() => subscribePlayerField(player, 'epWeights'), [player]),
		() => player.getEpWeights(),
	);

	// `calculateEp` writes `epValues` from `weights`, which normalisation leaves alone, so deriving it is what the vanilla panel's re-normalise-on-reference-change did.
	const result = useMemo(() => (simResult ? calculateEp(simResult, refStats) : null), [simResult, refStats]);
	const prevSimResult = useMemo(() => result ?? emptyStatWeightsResult(), [result]);
	const stats = useMemo(() => visibleEpUnitStats(epStatSet, showAllStats), [epStatSet, showAllStats]);

	const applyWeights = useCallback(
		(newWeights: Stats) => player.setEpWeights(epWeightsWithoutExcluded(newWeights, player.getEpWeights(), settings)),
		[player, settings],
	);

	const columns = useMemo(
		() =>
			buildEpColumns(
				statsTableColumns({
					getPrevSimResult: () => prevSimResult,
					getDefaultEpWeights: () => individualConfig.defaults.epWeights.toProto(),
					getDpsEpRefStat: () => refStats.dps ?? epReferenceStat,
					getHealEpRefStat: () => refStats.heal ?? epReferenceStat,
					getTankEpRefStat: () => refStats.tank ?? Stat.StatArmor,
				}),
				weights => applyWeights(Stats.fromProto(weights)),
			),
		[prevSimResult, individualConfig, refStats, epReferenceStat, applyWeights],
	);

	const onComputeEp = useCallback(() => {
		const combine = statsType === StatsType.Ep ? combineScaledEpValues : combineScaledWeights;
		applyWeights(combine(prevSimResult, player.getEpRatios()));
	}, [statsType, prevSimResult, player, applyWeights]);

	const handleOpenChange = useCallback(
		(next: boolean) => {
			onOpenChange(next);
			if (!next) abort().catch(console.error);
		},
		[onOpenChange, abort],
	);

	const onCancel = useCallback(() => {
		if (isAborting) return;
		abort().catch(error => {
			console.error('Error on stat weight abort!');
			console.error(error);
		});
	}, [abort, isAborting]);

	const onCalculate = useCallback(async () => {
		trackEvent({ action: 'sim', category: 'stat_weights', label: 'calculate' });
		if (isRunning) return;
		setProgress({ stage: 'initializing' });

		let result: StatWeightsResult | null = null;
		let runIterations = 0;
		try {
			runIterations = sim.getIterations();
			setProgress({ stage: 'running' });
			result = await startStatWeights({
				epStats: epStats.filter(stat => !settings.isStatExcludedFromCalc(stat)),
				epPseudoStats: epPseudoStats.filter(pseudoStat => !settings.isPseudoStatExcludedFromCalc(pseudoStat)),
				epReferenceStat,
			});
			if (result.error) {
				if (result.error.type === ErrorOutcomeType.ErrorOutcomeAborted) toastManager.add({ variant: 'info', body: 'Statweight sim cancelled.' });
				result = null;
			}
		} catch (error: any) {
			console.error(error);
			toastManager.add({
				variant: 'error',
				body: error?.message || 'Something went wrong calculating your stat weights. Reload the page and try again.',
			});
			result = null;
		}

		if (!result) return;
		setIterations(runIterations);
		setSimResult(result);
	}, [sim, player, settings, epStats, epPseudoStats, epReferenceStat]);

	return (
		<Dialog
			open={open}
			onOpenChange={handleOpenChange}
			className="ep-weights-menu"
			container={host.rootElem}
			size={showThreatMetrics ? 'xl' : 'lg'}
			scrollContents
			keepMounted
			title={i18n.t('sidebar.buttons.stat_weights.modal.title')}
			footer={
				<Button className="calc-weights" disabled={isRunning} onClick={() => void onCalculate()}>
					<Icon name="calculator" className="me-1" />
					{i18n.t('sidebar.buttons.stat_weights.modal.calculate')}
				</Button>
			}>
			<div className="d-flex flex-column flex-lg-row align-items-lg-start gap-3">
				<div className="ep-weights-content order-1 order-lg-0">
					<EpWeightsOptions onStatsTypeChange={setStatsType} onShowAllStatsChange={setShowAllStats} />
					<EpReferenceOptions epStats={epStats} epReferenceStat={epReferenceStat} />
					<p>
						{i18n.t('sidebar.buttons.stat_weights.modal.current_ep_description')}
						<br />
						{i18n.t('sidebar.buttons.stat_weights.modal.copy_icon_description')}
					</p>
					<EpWeightsTable
						columns={columns}
						stats={stats}
						statsType={statsType}
						result={result}
						iterations={iterations || 1}
						epRatios={epRatios}
						epWeights={epWeights}
						settings={settings}
						player={player}
						epStatSet={epStatSet}
						epReferenceStat={epReferenceStat}
						onComputeEp={onComputeEp}
					/>
				</div>
				<div className="ep-weights-sidebar sticky-lg-top order-0 order-lg-1">
					<SavedEpWeights />
				</div>
			</div>
			<Tooltip id={EP_TOOLTIP_ID} />
			{isRunning && (
				<ProgressTrackerDialog
					ref={progressRef}
					open
					container={host.rootElem}
					className="ep-weights-progress"
					title={i18n.t('sidebar.buttons.stat_weights.modal.title')}
					state={progress}
					hasProgressBar
					onCancel={onCancel}
				/>
			)}
		</Dialog>
	);
};
