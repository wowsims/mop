import { SimRun, SimRunData } from '../proto/ui';
import { SimResult } from '../proto_utils/sim_result';
import { SimUI } from '../sim_ui';
import { TypedEvent } from '../typed_event';
import { Component } from './component';
import { AuraMetricsTable } from './detailed_results/aura_metrics';
import { CastMetricsTable } from './detailed_results/cast_metrics';
import { DamageMetricsTable } from './detailed_results/damage_metrics';
import { DpsHistogram } from './detailed_results/dps_histogram';
import { DtpsMetricsTable } from './detailed_results/dtps_metrics';
import { HealingMetricsTable } from './detailed_results/healing_metrics';
import { LogRunner } from './detailed_results/log_runner';
import { PlayerDamageMetricsTable } from './detailed_results/player_damage';
import { PlayerDamageTakenMetricsTable } from './detailed_results/player_damage_taken';
import { ResourceMetricsTable } from './detailed_results/resource_metrics';
import { SimResultData } from './detailed_results/result_component';
import { ResultsFilter } from './detailed_results/results_filter';
import { Timeline } from './detailed_results/timeline';
import { ToplineResults } from './detailed_results/topline_results';
import { RaidSimResultsManager } from './raid_sim_action';
import { StickyToolbar } from './sticky_toolbar';
import i18n from '../../i18n/config';
import { ref } from 'tsx-vanilla';
import { isDevMode } from '../utils';
import { IndividualSimUI } from '../individual_sim_ui';
import { trackEvent } from '../../tracking/utils';

type Tab = {
	isActive?: boolean;
	targetId: string;
	label: string;
	classes?: string[];
};

const tabs: Tab[] = [
	{
		isActive: true,
		targetId: 'damageTab',
		label: i18n.t('results_tab.details.tabs.damage'),
		classes: ['damage-metrics-tab'],
	},
	{
		targetId: 'healingTab',
		label: i18n.t('results_tab.details.tabs.healing'),
		classes: ['healing-metrics-tab'],
	},
	{
		targetId: 'damageTakenTab',
		label: i18n.t('results_tab.details.tabs.damage_taken'),
		classes: ['threat-metrics-tab'],
	},
	{
		targetId: 'buffsTab',
		label: i18n.t('results_tab.details.tabs.buffs'),
	},
	{
		targetId: 'debuffsTab',
		label: i18n.t('results_tab.details.tabs.debuffs'),
	},
	{
		targetId: 'castsTab',
		label: i18n.t('results_tab.details.tabs.casts'),
	},
	{
		targetId: 'resourcesTab',
		label: i18n.t('results_tab.details.tabs.resources'),
	},
	{
		targetId: 'timelineTab',
		label: i18n.t('results_tab.details.tabs.timeline'),
	},
	{
		targetId: 'logTab',
		label: i18n.t('results_tab.details.tabs.log'),
	},
];

export class DetailedResults extends Component {
	protected readonly simUI: SimUI;
	protected latestRun: SimRunData | null = null;
	protected latestDeathSeeds: bigint[] = [];
	protected recentlyEditedSeed: boolean = false;

	private currentSimResult: SimResult | null = null;
	private resultsEmitter: TypedEvent<SimResultData | null> = new TypedEvent<SimResultData | null>();
	private resultsFilter: ResultsFilter;
	private rootDiv: Element;

	constructor(parent: HTMLElement, simUI: SimUI, simResultsManager: RaidSimResultsManager) {
		super(parent, 'detailed-results-manager-root');

		this.simUI = simUI;

		this.rootDiv = (
			<div className="dr-root dr-no-results">
				<div className="dr-toolbar">
					<div className="results-filter"></div>
					<div className="tabs-filler"></div>
					<ul className="nav nav-tabs" attributes={{ role: 'tablist' }}>
						{tabs.map(({ label, targetId, isActive, classes }) => (
							<li className={`nav-item dr-tab-tab ${classes?.join(' ') || ''}`} attributes={{ role: 'presentation' }}>
								<button
									className={`nav-link${isActive ? ' active' : ''}`}
									type="button"
									attributes={{
										role: 'tab',
										// @ts-expect-error
										'aria-controls': targetId,
										'aria-selected': !!isActive,
									}}
									dataset={{
										bsToggle: 'tab',
										bsTarget: `#${targetId}`,
									}}>
									{label}
								</button>
							</li>
						))}
					</ul>
				</div>
				<div className="tab-content">
					<div id="noResultsTab" className="tab-pane dr-tab-content fade active show">
						{i18n.t('results_tab.details.no_results')}
					</div>
					<div id="damageTab" className="tab-pane dr-tab-content damage-content fade active show">
						<div className="dr-row topline-results" />
						<div className="dr-row all-players-only">
							<div className="player-damage-metrics" />
						</div>
						<div className="dr-row single-player-only">
							<div className="damage-metrics" />
						</div>
						{/* <div className="dr-row single-player-only">
							<div className="melee-metrics" />
						</div>
						<div className="dr-row single-player-only">
							<div className="spell-metrics" />
						</div> */}
						<div className="dr-row dps-histogram" />
					</div>
					<div id="healingTab" className="tab-pane dr-tab-content healing-content fade">
						<div className="dr-row topline-results" />
						<div className="dr-row single-player-only">
							<div className="healing-spell-metrics" />
						</div>
						<div className="dr-row hps-histogram" />
					</div>
					<div id="damageTakenTab" className="tab-pane dr-tab-content damage-taken-content fade">
						<div className="dr-row topline-results" />
						<div className="dr-row all-players-only">
							<div className="player-damage-taken-metrics" />
						</div>
						<div className="dr-row single-player-only">
							<div className="dtps-metrics" />
						</div>
						<div className="dr-row damage-taken-histogram single-player-only" />
					</div>
					<div id="buffsTab" className="tab-pane dr-tab-content buffs-content fade">
						<div className="dr-row">
							<div className="buff-aura-metrics" />
						</div>
					</div>
					<div id="debuffsTab" className="tab-pane dr-tab-content debuffs-content fade">
						<div className="dr-row">
							<div className="debuff-aura-metrics" />
						</div>
					</div>
					<div id="castsTab" className="tab-pane dr-tab-content casts-content fade">
						<div className="dr-row">
							<div className="cast-metrics" />
						</div>
					</div>
					<div id="resourcesTab" className="tab-pane dr-tab-content resources-content fade">
						<div className="dr-row">
							<div className="resource-metrics" />
						</div>
					</div>
					<div id="timelineTab" className="tab-pane dr-tab-content timeline-content fade">
						<div className="dr-row">
							<div className="timeline" />
						</div>
					</div>
					<div id="logTab" className="tab-pane dr-tab-content log-content fade">
						<div className="dr-row">
							<div className="log" />
						</div>
					</div>
				</div>
			</div>
		);

		const simButtonRef = ref<HTMLButtonElement>();
		const deathButtonRef = ref<HTMLButtonElement>();

		this.rootElem.appendChild(
			<>
				<div className="detailed-results-controls-div">
					<button className="detailed-results-1-iteration-button btn btn-primary" ref={simButtonRef} disabled={simUI.disabled}>
						{i18n.t('results_tab.details.sim_1_iteration')}
					</button>
					<button className="detailed-results-death-iteration-button btn btn-primary" ref={deathButtonRef} disabled={true}>
						{i18n.t('results_tab.details.sim_1_death')}
					</button>
				</div>
				{this.rootDiv}
			</>,
		);

		this.simUI.sim.settingsChangeEmitter.on(() => this.updateSettings());

		// Allow styling the sticky toolbar
		const toolbar = document.querySelector<HTMLElement>('.dr-toolbar')!;
		new StickyToolbar(toolbar, this.simUI);

		this.resultsFilter = new ResultsFilter({
			parent: this.rootElem.querySelector('.results-filter')!,
			resultsEmitter: this.resultsEmitter,
		});

		[...this.rootElem.querySelectorAll<HTMLElement>('.topline-results')]?.forEach(toplineResultsDiv => {
			new ToplineResults({ parent: toplineResultsDiv, resultsEmitter: this.resultsEmitter });
		});

		new CastMetricsTable({
			parent: this.rootElem.querySelector('.cast-metrics')!,
			resultsEmitter: this.resultsEmitter,
		});
		new DamageMetricsTable({
			parent: this.rootElem.querySelector('.damage-metrics')!,
			resultsEmitter: this.resultsEmitter,
		});

		new HealingMetricsTable({
			parent: this.rootElem.querySelector('.healing-spell-metrics')!,
			resultsEmitter: this.resultsEmitter,
		});
		new ResourceMetricsTable({
			parent: this.rootElem.querySelector('.resource-metrics')!,
			resultsEmitter: this.resultsEmitter,
			secondaryResource: (simUI as IndividualSimUI<any>)?.player?.secondaryResource,
		});
		new PlayerDamageMetricsTable(
			{ parent: this.rootElem.querySelector('.player-damage-metrics')!, resultsEmitter: this.resultsEmitter },
			this.resultsFilter,
		);
		new PlayerDamageTakenMetricsTable(
			{ parent: this.rootElem.querySelector('.player-damage-taken-metrics')!, resultsEmitter: this.resultsEmitter },
			this.resultsFilter,
		);
		new AuraMetricsTable(
			{
				parent: this.rootElem.querySelector('.buff-aura-metrics')!,
				resultsEmitter: this.resultsEmitter,
			},
			false,
		);
		new AuraMetricsTable(
			{
				parent: this.rootElem.querySelector('.debuff-aura-metrics')!,
				resultsEmitter: this.resultsEmitter,
			},
			true,
		);

		new DpsHistogram({
			parent: this.rootElem.querySelector('.dps-histogram')!,
			resultsEmitter: this.resultsEmitter,
		});

		new DtpsMetricsTable({
			parent: this.rootElem.querySelector('.dtps-metrics')!,
			resultsEmitter: this.resultsEmitter,
		});

		const timeline = new Timeline({
			parent: this.rootElem.querySelector('.timeline')!,
			resultsEmitter: this.resultsEmitter,
			secondaryResource: (simUI as IndividualSimUI<any>)?.player?.secondaryResource,
		});

		const tabEl = document.querySelector('button[data-bs-target="#timelineTab"]');
		tabEl?.addEventListener('shown.bs.tab', () => {
			timeline.render();
		});

		new LogRunner({
			parent: this.rootElem.querySelector('.log')!,
			resultsEmitter: this.resultsEmitter,
		});

		this.rootElem.classList.add('hide-threat-metrics');

		this.resultsFilter.changeEmitter.on(async () => await this.updateResults(this.latestRun));

		this.resultsEmitter.on((_, resultData) => {
			if (resultData?.filter.player || resultData?.filter.player === 0) {
				this.rootDiv.classList.remove('all-players');
				this.rootDiv.classList.add('single-player');
			} else {
				this.rootDiv.classList.add('all-players');
				this.rootDiv.classList.remove('single-player');
			}
		});

		const simButton = simButtonRef.value!;
		simButton?.addEventListener('click', () => {
			trackEvent({
				action: 'sim',
				category: 'simulate',
				label: 'once',
			});
			this.simUI?.runSimOnce();
		});

		const deathButton = deathButtonRef.value!;
		deathButton?.addEventListener('click', () => {
			trackEvent({
				action: 'sim',
				category: 'simulate',
				label: 'death',
			});
			if (this.latestDeathSeeds.length > 1) {
				this.simUI?.sim.setFixedRngSeed(TypedEvent.nextEventID(), Number(this.latestDeathSeeds.pop()));
				this.recentlyEditedSeed = true;

				if (isDevMode()) {
					console.log('Setting fixed seed:');
					console.log(this.simUI?.sim.getFixedRngSeed());
				}
			}

			this.simUI?.runSimOnce();
		});

		simResultsManager.currentChangeEmitter.on(async () => {
			const runData = simResultsManager.getRunData();
			if (runData) {
				this.updateSettings();
				await this.updateResults(runData);
			}

			deathButton.disabled = this.latestDeathSeeds.length < 2;
		});
	}

	private updateSettings() {
		if (this.recentlyEditedSeed) {
			this.simUI.sim.setFixedRngSeed(TypedEvent.nextEventID(), 0);
			this.recentlyEditedSeed = false;
		}

		const settings = this.simUI?.sim.toProto();
		if (!settings) return;

		if (settings.showDamageMetrics) {
			this.rootElem.classList.remove('hide-damage-metrics');
		} else {
			this.rootElem.classList.add('hide-damage-metrics');
			const damageTabEl = document.getElementById('damageTab')!;
			const healingTabEl = document.getElementById('healingTab')!;
			if (damageTabEl.classList.contains('active')) {
				damageTabEl.classList.remove('active', 'show');
				healingTabEl.classList.add('active', 'show');

				const toolbar = document.getElementsByClassName('dr-toolbar')[0] as HTMLElement;
				toolbar.querySelector('.damage-metrics')?.children[0].classList.remove('active');
				toolbar.querySelector('.healing-metrics')?.children[0].classList.add('active');
			}
		}
		this.rootElem.classList[settings.showThreatMetrics ? 'remove' : 'add']('hide-threat-metrics');
		this.rootElem.classList[settings.showHealingMetrics ? 'remove' : 'add']('hide-healing-metrics');
		this.rootElem.classList[settings.showExperimental ? 'remove' : 'add']('hide-experimental');
	}

	private async updateResults(simRunData: SimRunData | null) {
		if (simRunData?.run?.request?.requestId !== this.latestRun?.run?.request?.requestId) {
			this.latestRun = simRunData;
			this.currentSimResult = await SimResult.fromProto(simRunData?.run || SimRun.create());
		}

		const latestSimResult = this.latestRun?.run?.result;
		const playerMetrics = latestSimResult?.raidMetrics?.parties.map(party => party.players).flat();

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

			if (deathSeeds.length > 1 || this.latestDeathSeeds.length == 0) {
				this.latestDeathSeeds = deathSeeds;
			}
		}

		const eventID = TypedEvent.nextEventID();
		if (this.currentSimResult == null) {
			this.rootDiv.classList.add('dr-no-results');
			this.resultsEmitter.emit(eventID, null);
		} else {
			this.rootDiv.classList.remove('dr-no-results');
			this.resultsEmitter.emit(eventID, {
				eventID: eventID,
				result: this.currentSimResult,
				filter: this.resultsFilter.getFilter(),
			});
		}
	}
}
