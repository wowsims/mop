import { SimHeader } from '@app/header/sim_header';
import { SimTitleDropdown } from '@app/header/sim_title_dropdown';
import { SocialLinks } from '@app/header/social_links';
import { NoticeNativeSim } from '@app/notice_native_sim';
import { REPO_NEW_ISSUE_URL } from '@domain/constants/other';
import { PlayerSpec } from '@domain/player_spec';
import { ActionId } from '@domain/proto_utils/action_id';
import { Gear } from '@domain/proto_utils/gear';
import { SimResult } from '@domain/proto_utils/sim_result';
import { RunSimOptions, Sim, SimError } from '@domain/sim';
import { RequestTypes } from '@domain/sim_signal_manager';
import { EventID, nextEventID } from '@domain/state/batch';
import { SETTINGS_STORAGE_SUFFIX, SHARED_SAVED_ENCOUNTER_STORAGE_KEY } from '@domain/state/persistence';
import { StoreSubscribe, subscribeSimField, subscribeUiField } from '@domain/state/subscriptions';
import { isDevMode } from '@domain/utils';
import { WorkerProgressCallback } from '@domain/worker_pool';
import { ResultsViewer } from '@features/results/view/results_viewer';
import { BaseModal } from '@ui-kit/base_modal';
import { Component } from '@ui-kit/component';
import { NumberPicker } from '@ui-kit/pickers/number_picker';
import { SimTab } from '@ui-kit/sim_tab';
import Toast from '@ui-kit/toast';
import clsx from 'clsx';
import { ref } from 'tsx-vanilla';

import i18n from '../i18n/config';
import { trackEvent } from '../tracking/utils';
import { LaunchStatus, SimStatus } from './launched_sims';
import { ErrorOutcomeType } from './proto/api';
const URLMAXLEN = 2048;
const globalKnownIssues: Array<string> = [];

// Config for displaying a warning to the user whenever a condition is met.
export interface SimWarning {
	updateOn: StoreSubscribe;
	getContent: () => string | Array<string>;
}

export interface SimUIConfig {
	// Additional css class to add to the root element.
	cssClass: string;
	// Scheme used for themeing on a per-class Basis or for other sims
	cssScheme: string;
	// The spec, if an individual sim, or null if the raid sim.
	spec: PlayerSpec<any>;
	simStatus: SimStatus;
	knownIssues?: Array<string>;
	noticeText?: string;
}

// Shared UI for all individual sims and the raid sim.
export abstract class SimUI extends Component {
	readonly sim: Sim;
	readonly config: SimUIConfig;
	readonly disabled: boolean;

	readonly resultsViewer: ResultsViewer;
	readonly simHeader: SimHeader;

	readonly simContentContainer: HTMLElement;
	readonly simMain: HTMLElement;
	readonly simActionsContainer: HTMLElement;
	readonly iterationsPicker: HTMLElement;
	readonly simTabContentsContainer: HTMLElement;

	constructor(parentElem: HTMLElement, sim: Sim, config: SimUIConfig) {
		super(parentElem, 'sim-ui');
		this.sim = sim;
		this.config = config;
		this.disabled = !isDevMode() && config.simStatus.status === LaunchStatus.Unlaunched;

		const container = (
			<>
				<div className="sim-root">
					<div className="sim-bg" />
					{config.noticeText ? (
						<div className="notices-banner alert border-bottom mb-0 text-center within-raid-sim-hide">{config.noticeText}</div>
					) : null}
					<div className="sim-container">
						<aside className="sim-sidebar">
							<div className="sim-title" />
							<div className="sim-sidebar-content">
								<div className="sim-sidebar-actions within-raid-sim-hide" />
								<div className="sim-sidebar-results within-raid-sim-hide" />
								<div className="sim-sidebar-stats" />
								<div className="sim-sidebar-socials" />
							</div>
						</aside>
						<div className="sim-content container-fluid" />
					</div>
				</div>
				<div className="sim-toast-container p-3 bottom-0 right-0" id="toastContainer" />
			</>
		);

		this.rootElem.appendChild(container);

		this.simContentContainer = this.rootElem.querySelector('.sim-content') as HTMLElement;
		this.simHeader = new SimHeader(this.simContentContainer, this);
		this.simMain = document.createElement('main');
		this.simMain.classList.add('sim-main', 'tab-content');
		this.simContentContainer.appendChild(this.simMain);

		this.rootElem.classList.add(this.config.cssClass);

		if (this.config.spec.isHealingSpec) {
			this.rootElem.classList.add('sim-type--heal');
		} else if (this.config.spec.isTankSpec) {
			this.rootElem.classList.add('sim-type--tank');
		} else if (this.config.spec.isMeleeDpsSpec || this.config.spec.isRangedDpsSpec) {
			this.rootElem.classList.add('sim-type--dps', this.config.spec.isMeleeDpsSpec ? 'sim-type--melee' : 'sim-type--ranged');
		}

		this.sim.crashEmitter.on((error: SimError) => this.handleCrash(error));

		const updateShowDamageMetrics = () => {
			if (this.sim.getShowDamageMetrics()) this.rootElem.classList.remove('hide-damage-metrics');
			else this.rootElem.classList.add('hide-damage-metrics');
		};
		updateShowDamageMetrics();
		subscribeUiField(this.sim, 'showDamageMetrics')(updateShowDamageMetrics);

		const updateShowThreatMetrics = () => {
			if (this.sim.getShowThreatMetrics()) this.rootElem.classList.remove('hide-threat-metrics');
			else this.rootElem.classList.add('hide-threat-metrics');
		};
		updateShowThreatMetrics();
		subscribeUiField(this.sim, 'showThreatMetrics')(updateShowThreatMetrics);

		const updateShowHealingMetrics = () => {
			if (this.sim.getShowHealingMetrics()) this.rootElem.classList.remove('hide-healing-metrics');
			else this.rootElem.classList.add('hide-healing-metrics');
		};
		updateShowHealingMetrics();
		subscribeUiField(this.sim, 'showHealingMetrics')(updateShowHealingMetrics);

		const updateShowEpRatios = () => {
			// Threat metrics *always* shows multiple columns, so
			// always show ratios when they are shown
			if (this.sim.getShowThreatMetrics()) {
				this.rootElem.classList.remove('hide-ep-ratios');
				// This case doesn't currently happen, but who knows
				// what the future holds...
			} else if (this.sim.getShowDamageMetrics() && this.sim.getShowHealingMetrics()) {
				this.rootElem.classList.remove('hide-ep-ratios');
			} else {
				this.rootElem.classList.add('hide-ep-ratios');
			}
		};

		updateShowEpRatios();
		subscribeUiField(this.sim, 'showDamageMetrics')(updateShowEpRatios);
		subscribeUiField(this.sim, 'showHealingMetrics')(updateShowEpRatios);
		subscribeUiField(this.sim, 'showThreatMetrics')(updateShowEpRatios);

		const updateShowExperimental = () => {
			if (this.sim.getShowExperimental()) this.rootElem.classList.remove('hide-experimental');
			else this.rootElem.classList.add('hide-experimental');
		};
		updateShowExperimental();
		subscribeUiField(this.sim, 'showExperimental')(updateShowExperimental);

		this.addKnownIssues(config);

		// Sidebar Contents

		const titleElem = this.rootElem.querySelector('.sim-title') as HTMLElement;
		new SimTitleDropdown(titleElem, config.spec);

		this.simActionsContainer = this.rootElem.querySelector('.sim-sidebar-actions') as HTMLElement;

		this.sim.waitForInit().then(() => {
			this.addNoticeForNativeSim();
		});

		this.iterationsPicker = new NumberPicker(this.simActionsContainer, this.sim, {
			id: 'simui-iterations',
			label: i18n.t('sidebar.iterations'),
			extraCssClasses: ['iterations-picker'],
			storeSubscribe: (sim: Sim) => subscribeSimField(sim, 'iterations'),
			getValue: (sim: Sim) => sim.getIterations(),
			setValue: (eventID: EventID, sim: Sim, newValue: number) => {
				trackEvent({
					action: 'settings',
					category: 'iterations',
					label: 'update',
					value: newValue,
				});
				sim.setIterations(eventID, newValue);
			},
		}).rootElem;

		const resultsViewerElem = this.rootElem.querySelector('.sim-sidebar-results') as HTMLElement;
		this.resultsViewer = new ResultsViewer(resultsViewerElem);

		const socialsContainer = this.rootElem.querySelector('.sim-sidebar-socials') as HTMLElement;
		socialsContainer.appendChild(SocialLinks.buildDiscordLink());
		socialsContainer.appendChild(SocialLinks.buildGitHubLink());
		socialsContainer.appendChild(SocialLinks.buildPatreonLink());

		this.simTabContentsContainer = this.rootElem.querySelector('.sim-main.tab-content') as HTMLElement;

		if (this.disabled) {
			resultsViewerElem.appendChild(
				<div className="sim-ui-unlaunched-container d-flex flex-column align-items-center text-center mt-auto mb-auto ms-auto me-auto">
					<i className="fas fa-ban fa-3x mb-2" />
					<h6>{i18n.t('sim.unlaunched.title')}</h6>
					<p>
						{i18n.t('sim.unlaunched.contribute_message')}
						<br />
						{i18n.t('sim.unlaunched.discord_message')}{' '}
						<a href="https://discord.gg/p3DgvmnDCS" target="_blank">
							Discord
						</a>
						!
					</p>
					{this.config.spec.isHealingSpec && (
						<p>
							{i18n.t('sim.unlaunched.healing_message')}
							<br />
							{i18n.t('sim.unlaunched.qe_live_message')} <a href="https://questionablyepic.com/live/">QE Live</a>!
						</p>
					)}
				</div>,
			);
		}
	}

	addNoticeForNativeSim() {
		new NoticeNativeSim(this.simActionsContainer, this.sim);
	}

	addAction(label: string, cssClass: string, onClick: (event: MouseEvent) => void): HTMLButtonElement {
		const button = this.simActionsContainer.appendChild(
			<button className={clsx('sim-sidebar-action-button btn btn-primary w-100', cssClass)} onclick={onClick} disabled={this.disabled}>
				{label}
				<span className="sim-sidebar-action-button-loading-icon">
					<i className="fas fa-spinner fa-spin"></i>
				</span>
			</button>,
		) as HTMLButtonElement;

		return button;
	}

	addActionGroup(groups: ActionGroupItem[], groupOptions: { cssClass?: string } = {}) {
		const refs: HTMLButtonElement[] = [];
		const groupRef = ref<HTMLDivElement>();
		const { cssClass } = groupOptions;
		this.simActionsContainer.appendChild(
			<div ref={groupRef} className={clsx('d-flex btn-group w-100', cssClass)} attributes={{ role: 'group' }}>
				{groups.map(({ label, cssClass, children, onClick }) => (
					<button ref={ref => refs.push(ref)} onclick={onClick} className={clsx('sim-sidebar-action-button btn btn-primary', cssClass)}>
						{label}
						{children}
						<span className="sim-sidebar-action-button-loading-icon">
							<i className="fas fa-spinner fa-spin"></i>
						</span>
					</button>
				))}
			</div>,
		);

		return { group: groupRef.value!, children: refs };
	}

	addTab(title: string, cssClass: string, content: HTMLElement | Element) {
		const contentId = cssClass.replace(/\s+/g, '-') + '-tab';
		const isFirstTab = this.simTabContentsContainer.children.length == 0;

		this.simHeader.addTab(title, contentId);
		this.simTabContentsContainer.appendChild(
			<div id={contentId} className={clsx('tab-pane fade', isFirstTab && 'active show')}>
				{content}
			</div>,
		);
	}

	addSimTab(tab: SimTab) {
		this.simHeader.addSimTabLink(tab);
	}

	addWarning(warning: SimWarning) {
		this.resultsViewer.addWarning(warning);
	}

	private addKnownIssues(config: SimUIConfig) {
		let statusStr = '';
		switch (config.simStatus.status) {
			case LaunchStatus.Unlaunched:
				statusStr = i18n.t('info.status.unlaunched');
				break;
			case LaunchStatus.Alpha:
				statusStr = i18n.t('info.status.alpha');
				break;
			case LaunchStatus.Beta:
				statusStr = i18n.t('info.status.beta');
				break;
		}

		if (statusStr) {
			config.knownIssues = [statusStr].concat(config.knownIssues || []);
		}
		config.knownIssues?.forEach(issue => this.simHeader.addKnownIssue(issue));
		globalKnownIssues?.forEach(issue => this.simHeader.addKnownIssue(issue));
	}

	// Returns a key suitable for the browser's localStorage feature.
	abstract getStorageKey(postfix: string): string;

	getSettingsStorageKey(): string {
		return this.getStorageKey(SETTINGS_STORAGE_SUFFIX);
	}

	getSavedEncounterStorageKey(): string {
		// By skipping the call to this.getStorageKey(), saved encounters will be
		// shared across all sims.
		return SHARED_SAVED_ENCOUNTER_STORAGE_KEY;
	}

	isIndividualSim(): boolean {
		return this.rootElem.classList.contains('individual-sim-ui');
	}

	async runSim(onProgress: WorkerProgressCallback, options: RunSimOptions = {}) {
		this.resultsViewer.setPending();
		try {
			await this.sim.signalManager.abortType(RequestTypes.All);
			const result = await this.sim.runRaidSim(nextEventID(), onProgress, options);
			if (!(result instanceof SimResult) && result.type == ErrorOutcomeType.ErrorOutcomeAborted) {
				new Toast({
					variant: 'info',
					body: i18n.t('sim.notifications.raid_sim_cancelled'),
				});
				this.resultsViewer.hideAll();
			}
			return result;
		} catch (e) {
			this.resultsViewer.hideAll();
			this.handleCrash(e);
		}
	}

	// Runs a lightweight version of the sim that uses a gear set and doesn't compute combat logs or other expensive data,
	// and returns the raw result from the sim worker.
	async runSimLightweight(gear: Gear, onProgress: WorkerProgressCallback, options: RunSimOptions = {}) {
		try {
			await this.sim.signalManager.abortType(RequestTypes.All);
			return this.sim.runRaidSimLightweight(gear, onProgress, options);
		} catch (e) {
			this.handleCrash(e);
		}
	}

	async runSimOnce(options: RunSimOptions = {}) {
		this.resultsViewer.setPending();
		try {
			return await this.sim.runRaidSimWithLogs(nextEventID(), { debug: true, singleIteration: true, ...options });
		} catch (e) {
			this.resultsViewer.hideAll();
			this.handleCrash(e);
		}
	}

	async handleCrash(error: any): Promise<void> {
		if (!(error instanceof SimError)) {
			if (error.message) {
				new Toast({
					variant: 'error',
					body: error.message,
				});
			} else {
				alert(error);
			}
			return;
		}

		new Toast({
			variant: 'error',
			body: i18n.t('sim.notifications.simulation_failed'),
		});

		const errorStr = (error as SimError).errorStr;
		if (errorStr.startsWith('[USER_ERROR] ')) {
			let alertStr = errorStr.substring('[USER_ERROR] '.length);
			alertStr = await ActionId.replaceAllInString(alertStr);
			alert(alertStr);
			return;
		}

		if (window.confirm(i18n.t('sim.crash_report.confirm_title') + '\n' + errorStr + '\n' + i18n.t('sim.crash_report.confirm_message'))) {
			// Splice out just the line numbers
			const hash = this.hashCode(errorStr);
			const link = this.toLink();
			const rngSeed = this.sim.getLastUsedRngSeed();
			fetch('https://api.github.com/search/issues?q=is:issue+is:open+repo:wowsims/mop+' + hash)
				.then(resp => {
					resp.json().then(issues => {
						if (issues.total_count > 0) {
							window.open(issues.items[0].html_url, '_blank');
						} else {
							const url = new URL(REPO_NEW_ISSUE_URL);
							url.searchParams.append('title', `${i18n.t('sim.crash_report.report_title')} ${hash}`);
							url.searchParams.append('assignees', '');
							url.searchParams.append('labels', '');

							const maxBodyLength = URLMAXLEN - url.toString().length;
							let issueBody = `Link:\n${link}\n\nRNG Seed: ${rngSeed}\n\n${errorStr}`;
							if (link.includes('/raid/')) {
								// Move the actual error before the link, as it will likely get truncated.
								issueBody = `${errorStr}\nRNG Seed: ${rngSeed}\nLink:\n${link}`;
							}
							let truncated = false;
							while (issueBody.length > maxBodyLength - (truncated ? 3 : 0)) {
								issueBody = issueBody.slice(0, issueBody.lastIndexOf('%')); // Avoid truncating in the middle of a URLencoded segment.
								truncated = true;
							}
							if (truncated) {
								issueBody += '...';
								// The raid links are too large and will always cause truncation.
								// Prompt the user to add more information to the issue.
								new CrashModal(this.rootElem, link).open();
							}
							url.searchParams.append('body', issueBody);

							window.open(url.toString(), '_blank');
						}
					});
				})
				.catch(fetchErr => {
					alert(i18n.t('sim.notifications.failed_to_file_report') + fetchErr);
				});
		}
	}

	hashCode(str: string): number {
		let hash = 0;
		for (let i = 0, len = str.length; i < len; i++) {
			const chr = str.charCodeAt(i);
			hash = (hash << 5) - hash + chr;
			hash |= 0; // Convert to 32bit integer
		}
		return hash;
	}

	abstract applyDefaults(eventID: EventID): void;
	abstract toLink(): string;
}

class CrashModal extends BaseModal {
	constructor(parent: HTMLElement, link: string) {
		super(parent, 'crash', { title: i18n.t('sim.crash_modal.title') });
		this.body.appendChild(
			<div className="sim-crash-report">
				<h3 className="sim-crash-report-header">{i18n.t('sim.crash_modal.header')}</h3>
				<textarea className="sim-crash-report-text form-control">{link}</textarea>
			</div>,
		);
	}
}

export type ActionGroupItem = { label?: string; children?: Element; cssClass?: string; onClick?: (event: MouseEvent) => void };
