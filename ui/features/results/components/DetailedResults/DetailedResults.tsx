import { hideMetricsClassName } from '@features/results/model/sim_results';
import { SimRun, SimRunData } from '@generated/proto/ui';
import i18n from '@i18n/config';
import { useSimHost } from '@sim/context/SimHostContext';
import { useDisplayMetrics } from '@sim/hooks/useDisplayMetrics';
import { useShowExperimental } from '@sim/hooks/useShowExperimental';
import { SimResult } from '@sim/proto/sim_result';
import { subscribeSimSettingsChange } from '@sim/state/subscriptions';
import { isDevMode } from '@sim/utils/env';
import { useStickyToolbar } from '@ui-kit/hooks/useStickyToolbar';
import { useTabFade } from '@ui-kit/hooks/useTabFade';
import clsx from 'clsx';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { trackEvent } from '../../../../tracking/analytics';
import { useSimResult } from '../../hooks/useSimResult';
import type { LogExporterFactory } from '../../model/log_exporter';
import type { SimResultsManager } from '../../model/results_manager';
import { AuraMetricsTable } from '../AuraMetricsTable';
import { CastMetricsTable } from '../CastMetricsTable';
import { CombatReplay } from '../CombatReplay';
import { DamageMetricsTable } from '../DamageMetricsTable';
import { DpsHistogram } from '../DpsHistogram';
import { DtpsMetricsTable } from '../DtpsMetricsTable';
import { HealingMetricsTable } from '../HealingMetricsTable';
import { LogRunner } from '../LogRunner';
import { ResourceMetricsTable } from '../ResourceMetricsTable';
import { ALL_UNITS, hasTarget, ResultsFilter, simResultFilter } from '../ResultsFilter';
import { Timeline } from '../Timeline';
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

	const settingsSubscribe = useMemo(() => subscribeSimSettingsChange(sim), [sim]);
	const { damage: showDamage, threat: showThreat, healing: showHealing } = useDisplayMetrics(sim);
	const showExperimental = useShowExperimental(sim);

	const [activeId, setActiveId] = useState<string>(DEFAULT_DETAILED_RESULTS_TAB);
	const shownId = useTabFade(activeId);
	const [deathDisabled, setDeathDisabled] = useState(true);
	const [target, setTarget] = useState(ALL_UNITS);
	const hasResults = useSimResult() !== null;

	const { ref: toolbarRef, stuck } = useStickyToolbar<HTMLDivElement>(host.simHeader.rootElem);
	// `updateResults` is bound to the emitter, not to the filter, so the selection it reads is a ref.
	const targetRef = useRef(target);
	// What the last emit already carried, so the reset below does not queue a second one.
	const emittedTarget = useRef(target);

	const latestRun = useRef<SimRunData | null>(null);
	const currentSimResult = useRef<SimResult | null>(null);
	const latestDeathSeeds = useRef<Array<bigint>>([]);
	const recentlyEditedSeed = useRef(false);

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
				// A run with fewer targets than the last one drops the selection, and it happens here
				// rather than in the filter: the emit below is what every metrics table reads, and a
				// component-level effect would let one render through pointing at a target this
				// result does not have.
				if (!hasTarget(currentSimResult.current, targetRef.current)) {
					targetRef.current = ALL_UNITS;
					emittedTarget.current = ALL_UNITS;
					setTarget(ALL_UNITS);
				}
				resultsEmitter.emit({ result: currentSimResult.current, filter: simResultFilter(targetRef.current) });
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

	// The filter's `changeEmitter`, whose only subscriber this was: picking a target re-emits the
	// last run under the new filter. Guarded on the value rather than on a mount flag, so a change
	// of `updateResults` cannot fire it on its own.
	useEffect(() => {
		if (emittedTarget.current === target) return;
		emittedTarget.current = target;
		void updateResults(latestRun.current);
	}, [target, updateResults]);

	useEffect(() => {
		if (!showDamage && activeId === 'damageTab') setActiveId('healingTab');
	}, [showDamage, activeId]);

	const paneState = (id: string) => ({ active: activeId === id, shown: shownId === id });

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
				!showDamage && hideMetricsClassName('damage'),
				!showThreat && hideMetricsClassName('threat'),
				!showHealing && hideMetricsClassName('healing'),
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
					<div className="results-filter">
						<ResultsFilter
							target={target}
							onTargetChange={next => {
								targetRef.current = next;
								setTarget(next);
							}}
						/>
					</div>
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
							<div className="timeline">
								<Timeline active={activeId === 'timelineTab'} />
							</div>
						</div>
					</DetailedResultsPane>
					<DetailedResultsPane id="replayTab" className="replay-content" {...paneState('replayTab')}>
						<div className="dr-row">
							<div className="combat-replay">
								<CombatReplay active={activeId === 'replayTab'} />
							</div>
						</div>
					</DetailedResultsPane>
					<DetailedResultsPane id="logTab" className="log-content" {...paneState('logTab')}>
						<div className="dr-row">
							<div className="log">
								<LogRunner active={activeId === 'logTab'} makeLogExporter={makeLogExporter} />
							</div>
						</div>
					</DetailedResultsPane>
				</div>
			</div>
		</div>
	);
};
