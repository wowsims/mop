/** @jsxImportSource @jsx-vanilla */
import { LaunchStatus, REPO_NEW_ISSUE_URL } from '@sim/constants/other';
import { isDevMode } from '@sim/utils/env';
import { PlayerSpec, SimStatus } from '@sim/player/player_spec';
import { ActionId } from '@sim/proto/action_id';
import { Gear } from '@sim/proto/gear';
import { SimResult } from '@sim/proto/sim_result';
import { RunSimOptions, Sim, SimError } from '@sim/sim';
import type { SimHost, SimWarning } from '@sim/sim_host';
import { RequestTypes } from '@sim/sim_signal_manager';
import { SETTINGS_STORAGE_SUFFIX, SHARED_SAVED_ENCOUNTER_STORAGE_KEY } from '@sim/state/persistence';
import { subscribeSimField } from '@sim/state/subscriptions';
import { WorkerProgressCallback } from '@sim/workers/worker_pool';
import { ResultsPanelStore } from '@features/results/components/SimResultsPanel';
import type { ResultsPanelHandle } from '@features/results/model/results_panel_handle';
import { WarningsRegistry } from '@features/results/model/warnings';
import { type ErrorOutcome, ErrorOutcomeType } from '@generated/proto/api';
import i18n from '@i18n/config';
import { BaseModal } from '@ui-kit/base_modal';
import { Component } from '@ui-kit/component';
import { NumberPicker } from '@ui-kit/pickers/number_picker';
import { SidebarRegistry } from '@ui-kit/sidebar_registry';
import { SimTabRegistry } from '@ui-kit/tab_registry';
import { toastManager } from '@ui-kit/Toast';
import type { ReactNode } from 'react';

import { trackEvent } from '../tracking/analytics';
import { SimHeader } from './header/sim_header';
import type { ShellDom } from './shell_dom';
import { SimRunKind } from '@sim/state/sim_store';
const URLMAXLEN = 2048;

export interface SimUIConfig {
	// Additional css class to add to the root element.
	cssClass: string;
	// Scheme used for themeing on a per-class Basis or for other sims
	cssScheme: string;
	// The spec of the individual sim.
	spec: PlayerSpec<any>;
	simStatus: SimStatus;
	knownIssues?: Array<ReactNode>;
	noticeText?: string;
}

export type { SimWarning } from '@sim/sim_host';

// Shared UI for all individual sims.
export abstract class SimUI extends Component implements SimHost {
	readonly sim: Sim;
	readonly config: SimUIConfig;
	readonly disabled: boolean;

	readonly resultsPanel = new ResultsPanelStore();
	readonly warnings = new WarningsRegistry();
	readonly simHeader: SimHeader;

	readonly simContentContainer: HTMLElement;
	readonly simMain: HTMLElement;
	readonly simActionsContainer: HTMLElement;
	readonly iterationsPicker: HTMLElement;
	readonly simTabContentsContainer: HTMLElement;
	readonly tabs: SimTabRegistry;
	readonly sidebar = new SidebarRegistry();
	protected readonly dom: ShellDom;

	constructor(dom: ShellDom, sim: Sim, config: SimUIConfig) {
		super(null, undefined, dom.root);
		this.dom = dom;
		this.sim = sim;
		this.config = config;
		this.disabled = !isDevMode() && config.simStatus.status === LaunchStatus.Unlaunched;

		this.simContentContainer = dom.content;
		this.simHeader = new SimHeader(dom, this);
		this.simMain = dom.main;
		this.tabs = new SimTabRegistry(this.simMain);

		this.sim.crashEmitter.on((error: SimError) => this.handleCrash(error));

		// Sidebar Contents

		this.simActionsContainer = dom.sidebarActions;

		this.iterationsPicker = new NumberPicker(this.simActionsContainer, this.sim, {
			id: 'simui-iterations',
			label: i18n.t('sidebar.iterations'),
			extraCssClasses: ['iterations-picker'],
			storeSubscribe: (sim: Sim) => subscribeSimField(sim, 'iterations'),
			getValue: (sim: Sim) => sim.getIterations(),
			setValue: (sim: Sim, newValue: number) => {
				trackEvent({
					action: 'settings',
					category: 'iterations',
					label: 'update',
					value: newValue,
				});
				sim.setIterations(newValue);
			},
		}).rootElem;

		this.simTabContentsContainer = dom.main;
	}

	get resultsViewer(): ResultsPanelHandle {
		return this.resultsPanel;
	}

	get sidebarResultsContainer(): HTMLElement {
		return this.dom.sidebarResults;
	}

	addTab(title: string, cssClass: string, content: HTMLElement | Element) {
		const contentId = cssClass.replace(/\s+/g, '-') + '-tab';

		const pane = (
			<div id={contentId} className="sim-tab">
				{content}
			</div>
		) as HTMLElement;

		this.tabs.attach({ id: contentId, title, pane, ariaControlsOnItem: true });
	}

	addWarning(warning: SimWarning) {
		this.warnings.add(warning);
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

	private notifyIfCancelled(result: SimResult | ErrorOutcome) {
		if (result instanceof SimResult || result.type != ErrorOutcomeType.ErrorOutcomeAborted) return;
		toastManager.add({
			variant: 'info',
			body: i18n.t('sim.notifications.sim_cancelled'),
		});
		this.resultsViewer.hideAll();
	}

	async runIndividualSim(onProgress: WorkerProgressCallback, options: RunSimOptions = {}) {
		this.resultsViewer.setPending();
		try {
			const result = await this.sim.runs.start(SimRunKind.IndividualSim, () => this.sim.runSim({ ...options, onProgress, raw: false }));
			this.notifyIfCancelled(result);
			return result;
		} catch (e) {
			this.resultsViewer.hideAll();
			this.handleCrash(e);
		}
	}

	async runGearSim(gear: Gear, onProgress: WorkerProgressCallback, options: RunSimOptions = {}) {
		try {
			await this.sim.signalManager.abortType(RequestTypes.IndividualSim);
			return this.sim.runSim({ ...options, gear, onProgress, raw: true });
		} catch (e) {
			this.handleCrash(e);
		}
	}

	async runSingleIteration(options: RunSimOptions = {}) {
		this.resultsViewer.setPending();
		try {
			const result = await this.sim.runs.start(SimRunKind.IndividualSim, () =>
				this.sim.runSim({ debug: true, singleIteration: true, ...options, raw: false }),
			);
			this.notifyIfCancelled(result);
			return result;
		} catch (e) {
			this.resultsViewer.hideAll();
			this.handleCrash(e);
		}
	}

	async handleCrash(error: any): Promise<void> {
		if (!(error instanceof SimError)) {
			if (error.message) {
				toastManager.add({
					variant: 'error',
					body: error.message,
				});
			} else {
				alert(error);
			}
			return;
		}

		toastManager.add({
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
							let truncated = false;
							while (issueBody.length > maxBodyLength - (truncated ? 3 : 0)) {
								issueBody = issueBody.slice(0, issueBody.lastIndexOf('%')); // Avoid truncating in the middle of a URLencoded segment.
								truncated = true;
							}
							if (truncated) {
								issueBody += '...';
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

	abstract applyDefaults(): void;
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
