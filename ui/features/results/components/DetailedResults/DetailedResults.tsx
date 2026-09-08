import { SimRun, SimRunData } from '@generated/proto/ui';
import { useDisplayMetrics } from '@sim/hooks/useDisplayMetrics';
import { useShowExperimental } from '@sim/hooks/useShowExperimental';
import i18n from '@i18n/config';
import { useSimHost } from '@sim/context/SimHostContext';
import { SimResult } from '@sim/proto/sim_result';
import { subscribeSimSettingsChange } from '@sim/state/subscriptions';
import { isDevMode } from '@sim/utils/env';
import { useLegacyMount } from '@ui-kit/hooks/useLegacyMount';
import clsx from 'clsx';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { trackEvent } from '../../../../tracking/analytics';
import { useSimResult } from '../../hooks/useSimResult';
import { CombatReplay } from '../../view/combat_replay';
import { type LogExporterFactory, LogView } from '../../view/log/log_view';
import type { ResultComponent } from '../../view/result_component';
import type { SimResultsManager } from '../../view/results_action';
import { ResultsFilter } from '../../view/results_filter';
import { Timeline } from '../../view/timeline';
import { AuraMetricsTable } from '../AuraMetricsTable';
import { CastMetricsTable } from '../CastMetricsTable';
import { DamageMetricsTable } from '../DamageMetricsTable';
import { DpsHistogram } from '../DpsHistogram';
import { DtpsMetricsTable } from '../DtpsMetricsTable';
import { HealingMetricsTable } from '../HealingMetricsTable';
import { ResourceMetricsTable } from '../ResourceMetricsTable';
import { ToplineResults } from '../ToplineResults';
import { DetailedResultsPane } from './DetailedResultsPane';
import { DetailedResultsTabs } from './DetailedResultsTabs';
import { DEFAULT_DETAILED_RESULTS_TAB, DETAILED_RESULTS_TABS } from './utils';

export interface DetailedResultsProps {
	resultsManager: SimResultsManager;
	makeLogExporter: LogExporterFactory;
}

export const DetailedResults = ({ resultsManager, makeLogExporter }: DetailedResultsProps) => {
	const host = useSimHost();
	const sim = host.sim;
	const resultsEmitter = host.resultChannel;
	const secondaryResource = host.player.secondaryResource;

	const settingsSubscribe = useMemo(() => subscribeSimSettingsChange(sim), [sim]);
	const { damage: showDamage, threat: showThreat, healing: showHealing } = useDisplayMetrics(sim);
	const showExperimental = useShowExperimental(sim);

	const [activeId, setActiveId] = useState<string>(DEFAULT_DETAILED_RESULTS_TAB);
	const [shownId, setShownId] = useState<string>(DEFAULT_DETAILED_RESULTS_TAB);
	const [stuck, setStuck] = useState(false);
	const [deathDisabled, setDeathDisabled] = useState(true);
	const hasResults = useSimResult() !== null;

	const toolbarRef = useRef<HTMLDivElement>(null);
	const resultsFilter = useRef<ResultsFilter | null>(null);
	const timeline = useRef<Timeline | null>(null);
	const combatReplay = useRef<CombatReplay | null>(null);
	const logView = useRef<LogView | null>(null);

	const latestRun = useRef<SimRunData | null>(null);
	const currentSimResult = useRef<SimResult | null>(null);
	const latestDeathSeeds = useRef<Array<bigint>>([]);
	const recentlyEditedSeed = useRef(false);

	const mountResultsFilter = useLegacyMount(
		parent => {
			resultsFilter.current = new ResultsFilter({ parent, resultsEmitter });
			return resultsFilter.current;
		},
		[resultsEmitter],
	);
	const mountTimeline = useLegacyMount(
		parent => {
			timeline.current = new Timeline({ parent, resultsEmitter, secondaryResource, deferUntilShown: true });
			return timeline.current;
		},
		[resultsEmitter, secondaryResource],
	);
	const mountCombatReplay = useLegacyMount(
		parent => {
			combatReplay.current = new CombatReplay({ parent, resultsEmitter, deferUntilShown: true });
			return combatReplay.current;
		},
		[resultsEmitter],
	);
	const mountLogView = useLegacyMount(
		parent => {
			logView.current = new LogView({ parent, resultsEmitter, deferUntilShown: true }, makeLogExporter);
			return logView.current;
		},
		[resultsEmitter, makeLogExporter],
	);

	const updateResults = useCallback(
		async (simRunData: SimRunData | null) => {
			if (simRunData?.run?.request?.requestId !== latestRun.current?.run?.request?.requestId) {
				latestRun.current = simRunData;
				currentSimResult.current = await SimResult.fromProto(simRunData?.run || SimRun.create());
			}

			const playerMetrics = latestRun.current?.run?.result?.raidMetrics?.parties.map(party => party.players).flat();

			if (isDevMode() && playerMetrics) {
				console.log('Found player metrics:');
				console.log(playerMetrics);
			}

			if (playerMetrics?.length) {
				const deathSeeds = playerMetrics[0].deathSeeds;

				if (isDevMode() && !!deathSeeds.length) {
					console.log('Found death seeds:');
					console.log(deathSeeds);
				}

				if (deathSeeds.length > 1 || latestDeathSeeds.current.length == 0) {
					latestDeathSeeds.current = deathSeeds;
				}
			}

			if (currentSimResult.current == null) {
				resultsEmitter.emit(null);
			} else {
				resultsEmitter.emit({ result: currentSimResult.current, filter: resultsFilter.current!.getFilter() });
			}
		},
		[resultsEmitter],
	);

	// The seed the "Simulate a Death" button pinned is released by the next settings change or run.
	const releaseEditedSeed = useCallback(() => {
		if (!recentlyEditedSeed.current) return;
		sim.setFixedRngSeed(0);
		recentlyEditedSeed.current = false;
	}, [sim]);

	useEffect(() => settingsSubscribe(releaseEditedSeed), [settingsSubscribe, releaseEditedSeed]);

	useEffect(
		() =>
			resultsManager.currentChangeEmitter.on(async () => {
				const runData = resultsManager.getRunData();
				if (runData) {
					releaseEditedSeed();
					await updateResults(runData);
				}
				setDeathDisabled(latestDeathSeeds.current.length < 2);
			}),
		[resultsManager, releaseEditedSeed, updateResults],
	);

	useEffect(() => resultsFilter.current?.changeEmitter.on(() => void updateResults(latestRun.current)), [updateResults]);

	useEffect(() => {
		if (!showDamage && activeId === 'damageTab') setActiveId('healingTab');
	}, [showDamage, activeId]);

	// `deferUntilShown` used to ride on Bootstrap's `shown.bs.tab` / `hide.bs.tab`; the switch itself is the event now.
	const previousId = useRef(DEFAULT_DETAILED_RESULTS_TAB);
	useEffect(() => {
		const previous = previousId.current;
		if (previous === activeId) return;
		previousId.current = activeId;

		const islands: Record<string, ResultComponent | null> = {
			timelineTab: timeline.current,
			replayTab: combatReplay.current,
			logTab: logView.current,
		};
		islands[previous]?.onTabHidden();
		if (previous === 'replayTab') combatReplay.current?.stopPlayback();
		islands[activeId]?.onTabShown();
	}, [activeId]);

	// Bootstrap set `active` first and `show` a frame later when switching, so its .15s fade ran; on the first render it set both at once.
	const lastShown = useRef<string | null>(null);
	useEffect(() => {
		const isSwitch = lastShown.current !== null && lastShown.current !== activeId;
		lastShown.current = activeId;
		if (!isSwitch) {
			setShownId(activeId);
			return;
		}
		const frame = requestAnimationFrame(() => setShownId(activeId));
		return () => cancelAnimationFrame(frame);
	}, [activeId]);

	useEffect(() => {
		const element = toolbarRef.current;
		if (!element) return;
		const observer = new IntersectionObserver(([entry]) => setStuck(element.clientHeight > 0 && entry.intersectionRatio < 1), {
			rootMargin: `-${host.simHeader.rootElem.offsetHeight + 1}px 0px 0px 0px`,
			threshold: [1],
		});
		observer.observe(element);
		return () => observer.disconnect();
	}, [host]);

	const paneState = (id: string) => ({ active: activeId === id, shown: activeId === id && shownId === id });

	const onSimulateDeath = () => {
		trackEvent({ action: 'sim', category: 'simulate', label: 'death' });

		if (latestDeathSeeds.current.length > 1) {
			sim.setFixedRngSeed(Number(latestDeathSeeds.current.pop()));
			recentlyEditedSeed.current = true;

			if (isDevMode()) {
				console.log('Setting fixed seed:');
				console.log(sim.getFixedRngSeed());
			}
		}

		void host.runSingleIteration();
	};

	return (
		<div
			className={clsx(
				'detailed-results-manager-root',
				!showDamage && 'hide-damage-metrics',
				!showThreat && 'hide-threat-metrics',
				!showHealing && 'hide-healing-metrics',
				!showExperimental && 'hide-experimental',
			)}>
			<div className="detailed-results-controls-div">
				<button
					className="detailed-results-1-iteration-button btn btn-primary"
					type="button"
					disabled={host.disabled}
					onClick={() => {
						trackEvent({ action: 'sim', category: 'simulate', label: 'once' });
						void host.runSingleIteration();
					}}>
					{i18n.t('results_tab.details.sim_1_iteration')}
				</button>
				<button className="detailed-results-death-iteration-button btn btn-primary" type="button" disabled={deathDisabled} onClick={onSimulateDeath}>
					{i18n.t('results_tab.details.sim_1_death')}
				</button>
			</div>
			<div className={clsx('dr-root', !hasResults && 'dr-no-results')}>
				<div ref={toolbarRef} className={clsx('dr-toolbar sticky-toolbar-root', stuck && 'stuck')}>
					<div className="results-filter" ref={mountResultsFilter} />
					<div className="tabs-filler" />
					<DetailedResultsTabs tabs={DETAILED_RESULTS_TABS} activeId={activeId} onSelect={setActiveId} />
				</div>
				<div className="tab-content">
					<div id="noResultsTab" className="tab-pane dr-tab-content fade active show">
						{i18n.t('results_tab.details.no_results')}
					</div>
					<DetailedResultsPane id="damageTab" className="damage-content" {...paneState('damageTab')}>
						<div className="dr-row topline-results">
							<ToplineResults />
						</div>
						<div className="dr-row">
							<div className="damage-metrics">
								<DamageMetricsTable />
							</div>
						</div>
						<div className="dr-row dps-histogram">
							<DpsHistogram />
						</div>
					</DetailedResultsPane>
					<DetailedResultsPane id="healingTab" className="healing-content" {...paneState('healingTab')}>
						<div className="dr-row topline-results">
							<ToplineResults />
						</div>
						<div className="dr-row">
							<div className="healing-spell-metrics">
								<HealingMetricsTable />
							</div>
						</div>
					</DetailedResultsPane>
					<DetailedResultsPane id="damageTakenTab" className="damage-taken-content" {...paneState('damageTakenTab')}>
						<div className="dr-row topline-results">
							<ToplineResults />
						</div>
						<div className="dr-row">
							<div className="dtps-metrics">
								<DtpsMetricsTable />
							</div>
						</div>
					</DetailedResultsPane>
					<DetailedResultsPane id="buffsTab" className="buffs-content" {...paneState('buffsTab')}>
						<div className="dr-row">
							<div className="buff-aura-metrics">
								<AuraMetricsTable useDebuffs={false} />
							</div>
						</div>
					</DetailedResultsPane>
					<DetailedResultsPane id="debuffsTab" className="debuffs-content" {...paneState('debuffsTab')}>
						<div className="dr-row">
							<div className="debuff-aura-metrics">
								<AuraMetricsTable useDebuffs={true} />
							</div>
						</div>
					</DetailedResultsPane>
					<DetailedResultsPane id="castsTab" className="casts-content" {...paneState('castsTab')}>
						<div className="dr-row">
							<div className="cast-metrics">
								<CastMetricsTable />
							</div>
						</div>
					</DetailedResultsPane>
					<DetailedResultsPane id="resourcesTab" className="resources-content" {...paneState('resourcesTab')}>
						<div className="dr-row">
							<div className="resource-metrics">
								<ResourceMetricsTable />
							</div>
						</div>
					</DetailedResultsPane>
					<DetailedResultsPane id="timelineTab" className="timeline-content" {...paneState('timelineTab')}>
						<div className="dr-row">
							<div className="timeline" ref={mountTimeline} />
						</div>
					</DetailedResultsPane>
					<DetailedResultsPane id="replayTab" className="replay-content" {...paneState('replayTab')}>
						<div className="dr-row">
							<div className="combat-replay" ref={mountCombatReplay} />
						</div>
					</DetailedResultsPane>
					<DetailedResultsPane id="logTab" className="log-content" {...paneState('logTab')}>
						<div className="dr-row">
							<div className="log" ref={mountLogView} />
						</div>
					</DetailedResultsPane>
				</div>
			</div>
		</div>
	);
};
