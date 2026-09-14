import { Tabs } from '@base-ui/react/tabs';
import { SimRun, SimRunData } from '@generated/proto/ui';
import i18n from '@i18n/config';
import { useSimHost } from '@sim/context/SimHostContext';
import { useDisplayMetrics } from '@sim/hooks/useDisplayMetrics';
import { SimResult } from '@sim/proto/sim_result';
import { subscribeSimSettingsChange } from '@sim/state/subscriptions';
import { isDevMode } from '@sim/utils/env';
import { Button } from '@ui-kit/Button';
import { useStickyToolbar } from '@ui-kit/hooks/useStickyToolbar';
import type { RefObject } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { trackEvent } from '../../../../tracking/analytics';
import { useSimResult } from '../../hooks/useSimResult';
import type { SimResultsManager } from '../../model/results_manager';
import { AuraMetricsTable } from '../AuraMetricsTable';
import { CastMetricsTable } from '../CastMetricsTable';
import { CombatReplay } from '../CombatReplay';
import { DamageMetricsTable } from '../DamageMetricsTable';
import { DtpsMetricsTable } from '../DtpsMetricsTable';
import { HealingMetricsTable } from '../HealingMetricsTable';
import { LogRunner } from '../LogRunner';
import { ResourceMetricsTable } from '../ResourceMetricsTable';
import { ALL_UNITS, hasTarget, ResultsFilter, simResultFilter } from '../ResultsFilter';
import { Timeline } from '../Timeline';
import { DetailedResultsPane } from './DetailedResultsPane';
import { DetailedResultsTabs } from './DetailedResultsTabs';
import { DrToolbarContext } from './DrToolbarContext';
import { DEFAULT_DETAILED_RESULTS_TAB, DETAILED_RESULTS_TABS } from './utils';

export interface DetailedResultsProps {
	resultsManager: SimResultsManager;
}

export const DetailedResults = ({ resultsManager }: DetailedResultsProps) => {
	const host = useSimHost();
	const sim = host.sim;
	const resultsEmitter = host.resultChannel;

	const settingsSubscribe = subscribeSimSettingsChange(sim);
	const { damage: showDamage, threat: showThreat, healing: showHealing } = useDisplayMetrics(sim);

	const visibleTabs = useMemo(
		() =>
			DETAILED_RESULTS_TABS.filter(tab => {
				if (tab.id === 'damageTab') return showDamage;
				if (tab.id === 'healingTab') return showHealing;
				if (tab.id === 'damageTakenTab') return showThreat;
				return true;
			}),
		[showDamage, showThreat, showHealing],
	);

	const [activeId, setActiveId] = useState<string>(DEFAULT_DETAILED_RESULTS_TAB);
	const [deathDisabled, setDeathDisabled] = useState(true);
	const [target, setTarget] = useState(ALL_UNITS);
	const hasResults = useSimResult() !== null;

	const { ref: toolbarRef, stuck, className: stickyToolbarClassName } = useStickyToolbar<HTMLDivElement>();
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
		if (visibleTabs.some(tab => tab.id === activeId)) return;
		setActiveId(visibleTabs[0]?.id ?? DEFAULT_DETAILED_RESULTS_TAB);
	}, [visibleTabs, activeId]);

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
		<div data-testid="detailed-results-manager-root" className="flex flex-col [&>*]:min-h-0">
			<div data-testid="detailed-results-controls-div" className="mb-3 flex">
				<Button
					data-testid="detailed-results-1-iteration-button"
					disabled={host.disabled}
					onClick={() => {
						trackEvent({ action: 'sim', category: 'simulate', label: 'once' });
						void host.runSingleIteration();
					}}>
					{i18n.t('results_tab.details.sim_1_iteration')}
				</Button>
				<Button className="ml-3" disabled={deathDisabled} onClick={onSimulateDeath}>
					{i18n.t('results_tab.details.sim_1_death')}
				</Button>
			</div>
			<DrToolbarContext.Provider value={toolbarRef as RefObject<HTMLElement | null>}>
				<Tabs.Root
					className="group/dr flex flex-col"
					data-testid="dr-root"
					data-no-results={!hasResults ? '' : undefined}
					value={activeId}
					onValueChange={next => setActiveId(String(next))}>
					<div ref={toolbarRef} data-testid="dr-toolbar" className={stickyToolbarClassName} data-stuck={stuck ? '' : undefined}>
						<div data-testid="results-filter" className="flex min-h-0 items-center">
							<ResultsFilter
								target={target}
								onTargetChange={next => {
									targetRef.current = next;
									setTarget(next);
								}}
							/>
						</div>
						<div className="min-h-0 grow" />
						<DetailedResultsTabs tabs={visibleTabs} />
					</div>
					<div className="grid grid-cols-1 items-start pt-6" data-testid="dr-tab-content">
						<div
							id="noResultsTab"
							data-active
							className="col-start-1 row-start-1 flex items-center justify-center p-6 text-base opacity-100 transition-opacity duration-150 ease-linear group-not-data-[no-results]/dr:hidden">
							{i18n.t('results_tab.details.no_results')}
						</div>
						{showDamage && (
							<DetailedResultsPane
								id="damageTab"
								className="[&_.ui-metrics-table]:text-xs"
								contentTestId="damage-spell-metrics"
								topline
								histogram>
								<DamageMetricsTable />
							</DetailedResultsPane>
						)}
						{showHealing && (
							<DetailedResultsPane id="healingTab" className="[&_.ui-metrics-table]:text-xs" contentTestId="healing-spell-metrics" topline>
								<HealingMetricsTable />
							</DetailedResultsPane>
						)}
						{showThreat && (
							<DetailedResultsPane id="damageTakenTab" contentTestId="dtps-metrics" topline>
								<DtpsMetricsTable />
							</DetailedResultsPane>
						)}
						<DetailedResultsPane id="buffsTab" contentTestId="buff-aura-metrics">
							<AuraMetricsTable useDebuffs={false} />
						</DetailedResultsPane>
						<DetailedResultsPane id="debuffsTab" contentTestId="debuff-aura-metrics">
							<AuraMetricsTable useDebuffs={true} />
						</DetailedResultsPane>
						<DetailedResultsPane id="castsTab" contentTestId="cast-metrics">
							<CastMetricsTable />
						</DetailedResultsPane>
						<DetailedResultsPane id="resourcesTab" contentTestId="resource-metrics">
							<ResourceMetricsTable />
						</DetailedResultsPane>
						<DetailedResultsPane id="timelineTab" contentTestId="timeline" filling>
							<Timeline active={activeId === 'timelineTab'} />
						</DetailedResultsPane>
						<DetailedResultsPane id="replayTab" className="p-0" contentTestId="combat-replay" filling>
							<CombatReplay active={activeId === 'replayTab'} />
						</DetailedResultsPane>
						<DetailedResultsPane id="logTab" contentTestId="log">
							<LogRunner active={activeId === 'logTab'} />
						</DetailedResultsPane>
					</div>
				</Tabs.Root>
			</DrToolbarContext.Provider>
		</div>
	);
};
