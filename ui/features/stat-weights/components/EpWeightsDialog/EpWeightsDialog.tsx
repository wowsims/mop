import './EpWeightsDialog.scss';

import { Stats } from '@domain/proto_utils/stats';
import { RequestTypes } from '@domain/sim_signal_manager';
import type { StatWeightActionSettings } from '@domain/stat_weight_settings';
import { subscribePlayerField, subscribeUiField } from '@domain/state/subscriptions';
import { useSimHost } from '@features/SimHostContext';
import { ErrorOutcomeType, type StatWeightsResult } from '@generated/proto/api';
import { Stat } from '@generated/proto/common';
import i18n from '@i18n/config';
import { Button } from '@ui-kit/Button';
import { Dialog } from '@ui-kit/Dialog';
import { useLegacyMount } from '@ui-kit/hooks/useLegacyMount';
import { useStoreSubscribe } from '@ui-kit/hooks/useStoreSubscribe';
import { Icon } from '@ui-kit/Icon';
import { ProgressTrackerDialog, type ProgressTrackerHandle, type ProgressTrackerState } from '@ui-kit/ProgressTrackerDialog';
import Toast from '@ui-kit/toast';
import { Tooltip } from '@ui-kit/Tooltip';
import { useCallback, useMemo, useRef, useState, useSyncExternalStore } from 'react';

import { trackEvent } from '../../../../tracking/analytics';
import { calculateEp, combineScaledEpValues, combineScaledWeights, emptyStatWeightsResult, epWeightsWithoutExcluded } from '../../model/ep_math';
import { visibleEpUnitStats } from '../../model/ep_unit_stats';
import type { EpWeightsOpener } from '../../model/ep_weights_opener';
import { statsTableColumns } from '../../model/stats_table';
import { renderSavedEPWeights } from '../../view/saved_ep_weights';
import { EpReferenceOptions } from './EpReferenceOptions';
import { EpWeightsOptions } from './EpWeightsOptions';
import { EpWeightsTable } from './EpWeightsTable';
import type { StatsType } from './types';
import { buildEpColumns, EP_TOOLTIP_ID } from './utils';

export interface EpWeightsDialogProps {
	opener: EpWeightsOpener;
	settings: StatWeightActionSettings;
}

export const EpWeightsDialog = ({ opener, settings }: EpWeightsDialogProps) => {
	const host = useSimHost();
	const { player, sim, individualConfig } = host;

	const open = useSyncExternalStore(opener.subscribe, opener.isOpen, opener.isOpen);

	const epStats = individualConfig.epStats;
	const epReferenceStat = individualConfig.epReferenceStat;
	const epPseudoStats = useMemo(() => individualConfig.epPseudoStats || [], [individualConfig]);
	const epStatSet = useMemo(() => ({ epStats, epPseudoStats }), [epStats, epPseudoStats]);

	const [statsType, setStatsType] = useState<StatsType>('ep');
	const [showAllStats, setShowAllStats] = useState(false);
	const [iterations, setIterations] = useState(0);
	const [simResult, setSimResult] = useState<StatWeightsResult | null>(null);
	const [running, setRunning] = useState(false);
	const [progress, setProgress] = useState<ProgressTrackerState>({ stage: 'initializing' });
	const runningRef = useRef(false);
	const cancellingRef = useRef(false);
	const progressRef = useRef<ProgressTrackerHandle>(null);

	const showThreatMetrics = useStoreSubscribe(
		useMemo(() => subscribeUiField(sim, 'showThreatMetrics'), [sim]),
		() => sim.getShowThreatMetrics(),
	);
	const refStats = useStoreSubscribe(
		useMemo(() => subscribePlayerField(player, 'epRefStat'), [player]),
		() => ({ dps: host.dpsRefStat, heal: host.healRefStat, tank: host.tankRefStat }),
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
		const combine = statsType === 'ep' ? combineScaledEpValues : combineScaledWeights;
		applyWeights(combine(prevSimResult, player.getEpRatios()));
	}, [statsType, prevSimResult, player, applyWeights]);

	const onOpenChange = useCallback(
		(next: boolean) => {
			opener.setOpen(next);
			if (!next) sim.signalManager.abortType(RequestTypes.StatWeights).catch(console.error);
		},
		[opener, sim],
	);

	const onCancel = useCallback(() => {
		if (cancellingRef.current) return;
		cancellingRef.current = true;
		sim.signalManager
			.abortType(RequestTypes.StatWeights)
			.catch(error => {
				console.error('Error on stat weight abort!');
				console.error(error);
			})
			.finally(() => {
				cancellingRef.current = false;
			});
	}, [sim]);

	const onCalculate = useCallback(async () => {
		trackEvent({ action: 'sim', category: 'stat_weights', label: 'calculate' });
		if (runningRef.current) return;
		runningRef.current = true;
		setRunning(true);
		setProgress({ stage: 'initializing' });

		let result: StatWeightsResult | null = null;
		let runIterations = 0;
		try {
			await sim.signalManager.abortType(RequestTypes.StatWeights);
			runIterations = sim.getIterations();
			setProgress({ stage: 'running' });
			result = await player.computeStatWeights(
				epStats.filter(stat => !settings.isStatExcludedFromCalc(stat)),
				epPseudoStats.filter(pseudoStat => !settings.isPseudoStatExcludedFromCalc(pseudoStat)),
				epReferenceStat,
				metrics =>
					progressRef.current?.setProgress({
						title: `${metrics.completedSims} / ${metrics.totalSims} ${i18n.t('sidebar.buttons.stat_weights.modal.progress.simulations_complete')}`,
						current: metrics.completedIterations,
						total: metrics.totalIterations,
					}),
			);
			if (result.error) {
				if (result.error.type === ErrorOutcomeType.ErrorOutcomeAborted) new Toast({ variant: 'info', body: 'Statweight sim cancelled.' });
				result = null;
			}
		} catch (error: any) {
			console.error(error);
			new Toast({ variant: 'error', body: error?.message || 'Something went wrong calculating your stat weights. Reload the page and try again.' });
			result = null;
		} finally {
			runningRef.current = false;
			setRunning(false);
		}

		if (!result) return;
		setIterations(runIterations);
		setSimResult(result);
	}, [sim, player, settings, epStats, epPseudoStats, epReferenceStat]);

	const mountSavedEpWeights = useLegacyMount(parent => renderSavedEPWeights(parent, host), [host]);

	return (
		<Dialog
			open={open}
			onOpenChange={onOpenChange}
			cssClass="ep-weights-menu"
			container={host.rootElem}
			size={showThreatMetrics ? 'xl' : 'lg'}
			scrollContents
			keepMounted
			title={i18n.t('sidebar.buttons.stat_weights.modal.title')}
			footer={
				<Button className="calc-weights" disabled={running} onClick={() => void onCalculate()}>
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
				<div className="ep-weights-sidebar sticky-lg-top order-0 order-lg-1" ref={mountSavedEpWeights} />
			</div>
			<Tooltip id={EP_TOOLTIP_ID} />
			{running && (
				<ProgressTrackerDialog
					ref={progressRef}
					open
					container={host.rootElem}
					cssClass="ep-weights-progress"
					title={i18n.t('sidebar.buttons.stat_weights.modal.title')}
					state={progress}
					hasProgressBar
					onCancel={onCancel}
				/>
			)}
		</Dialog>
	);
};
