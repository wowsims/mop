import { BulkTab } from '@features/bulk/bulk_tab';
import { watchTargetDummies } from '@features/encounter/model/target_dummies';
import { repairTargetInputs } from '@features/encounter/model/target_inputs';
import { registerSetBonusNotices } from '@features/gear/item_notices';
import { createLink } from '@features/import-export';
import { ReforgeSidebarGroup } from '@features/reforge/components/ReforgePanel';
import { createReforgeOptimizer, type ReforgeOptimizerModel, type ReforgeOptimizerOptions } from '@features/reforge/model/reforge_optimizer';
import { ResultsPanelStore } from '@features/results/components/SimResultsPanel';
import { defaultSimWarnings } from '@features/results/model/default_warnings';
import { ResultChannel } from '@features/results/model/result_channel';
import { SimResultsManager } from '@features/results/model/results_manager';
import type { ResultsPanelHandle } from '@features/results/model/results_panel_handle';
import { WarningsRegistry } from '@features/results/model/warnings';
import { applyEmptyAplRotation, applyIndividualDefaults } from '@features/settings/model/apply_defaults';
import * as OtherInputs from '@features/settings/model/other_inputs';
import { type ErrorOutcome, ErrorOutcomeType } from '@generated/proto/api';
import { Spec } from '@generated/proto/common';
import { IndividualSimSettings } from '@generated/proto/ui';
import i18n from '@i18n/config';
import { LaunchStatus } from '@sim/constants/other';
import { SimSettingCategories } from '@sim/constants/sim_settings';
import { Player } from '@sim/player/player';
import { Gear } from '@sim/proto/gear';
import { SimResult } from '@sim/proto/sim_result';
import { StatWeightActionSettings } from '@sim/settings/stat_weight_settings';
import { RunSimOptions, Sim, SimError } from '@sim/sim';
import type { IndividualSimHost, SimWarning } from '@sim/sim_host';
import { RequestTypes } from '@sim/sim_signal_manager';
import type { SpecDefinition } from '@sim/spec_config';
import { IndividualSimUIConfig, itemSwapEnabledSpecs } from '@sim/spec_config';
import { loadIndividualSettings, SETTINGS_STORAGE_SUFFIX, SHARED_SAVED_ENCOUNTER_STORAGE_KEY } from '@sim/state/persistence';
import {
	applyIndividualSimSettings,
	IndividualSimSerializationContext,
	individualSimSettingsToProto,
	updateIndividualSimProtoVersion,
} from '@sim/state/serialization';
import { SimRunKind } from '@sim/state/sim_store';
import {
	SAVED_EP_WEIGHTS_STORAGE_KEY,
	SAVED_GEAR_STORAGE_KEY,
	SAVED_ROTATION_STORAGE_KEY,
	SAVED_SETTINGS_STORAGE_KEY,
	SAVED_TALENTS_STORAGE_KEY,
	specStorageKey,
	STAT_WEIGHT_SETTINGS_STORAGE_KEY,
} from '@sim/state/storage_keys';
import { subscribeAll, subscribeReforgeChange, subscribeSimChange } from '@sim/state/subscriptions';
import { isDevMode } from '@sim/utils/env';
import { WorkerProgressCallback } from '@sim/workers/worker_pool';
import { SidebarRegistry } from '@ui-kit/sidebar_registry';
import { toastManager } from '@ui-kit/Toast';
import { createElement } from 'react';

import { reportSimCrash } from './crash_report';
import { CrashReportOpener } from './crash_report_opener';
import type { ShellDom } from './types/shell_dom';

export type {
	CustomSection,
	DerivedSetting,
	IndividualSimUIConfig,
	InputConfig,
	InputSection,
	OtherDefaults,
	Settings,
	SpecBehaviors,
	SpecDefinition,
} from '@sim/spec_config';
export { defineSpec, itemSwapEnabledSpecs, registerSpecConfig } from '@sim/spec_config';
// The individual sim's host: the registries, openers and cross-cutting actions the React tree
// reaches through `useSimHost()`. `SimShell` owns every element handed to the constructor.
export class SimHostObject<SpecType extends Spec> implements IndividualSimHost<SpecType> {
	readonly sim: Sim;
	readonly disabled: boolean;
	readonly rootElem: HTMLElement;

	readonly resultsPanel = new ResultsPanelStore();
	readonly warnings = new WarningsRegistry();

	readonly headerElem: HTMLElement;
	readonly simActionsContainer: HTMLElement;
	readonly simTabContentsContainer: HTMLElement;
	readonly sidebar = new SidebarRegistry();

	readonly player: Player<SpecType>;
	readonly individualConfig: IndividualSimUIConfig<SpecType>;
	readonly statWeightActionSettings: StatWeightActionSettings;

	readonly raidSimResultsManager: SimResultsManager;
	readonly crashReport = new CrashReportOpener();
	readonly resultChannel = new ResultChannel();

	private serializationContext(): IndividualSimSerializationContext {
		return {
			player: this.player,
			sim: this.sim,
			reforgeSettings: this.reforger?.settings,
			defaultEpWeights: this.individualConfig.defaults.epWeights,
		};
	}

	readonly bt: BulkTab;
	reforger: ReforgeOptimizerModel | null = null;
	// The view's own inputs, resolved here because `config.reforge` may be a function and must run once.
	reforgeOptions: ReforgeOptimizerOptions | null = null;

	constructor(dom: ShellDom, player: Player<SpecType>, config: SpecDefinition<SpecType>) {
		this.rootElem = dom.root;
		this.sim = player.sim;
		this.disabled = !isDevMode() && player.getPlayerSpec().launch.status === LaunchStatus.Unlaunched;

		this.sim.crashEmitter.on((error: SimError) => this.handleCrash(error));

		this.headerElem = dom.header;
		this.simActionsContainer = dom.sidebarActions;
		this.simTabContentsContainer = dom.main;

		this.player = player;
		this.individualConfig = this.applyDefaultConfigOptions(config);
		this.raidSimResultsManager = new SimResultsManager(this.sim);
		this.statWeightActionSettings = new StatWeightActionSettings(this.player, this.getStorageKey(STAT_WEIGHT_SETTINGS_STORAGE_KEY));

		if ((config.itemSwapSlots || []).length > 0 && !itemSwapEnabledSpecs.includes(player.getSpec())) {
			itemSwapEnabledSpecs.push(player.getSpec());
		}

		defaultSimWarnings(this.player, this.individualConfig).forEach(warning => this.addWarning(warning));
		(config.warnings || []).forEach(warning => this.addWarning(warning(this)));

		// This needs to go before all the UI components so that gear loading is the
		// first callback invoked from waitForInit().
		this.sim.waitForInit().then(() => {
			registerSetBonusNotices(this.sim.db);
			this.loadSettings();

			if (this.player.getPlayerSpec().isHealingSpec && !isDevMode()) {
				alert(i18n.t('sim.healing_sim_disclaimer'));
			}
		});

		this.sim.simResultEmitter.on(simResult => {
			// The result before the stage: `showResult` notifies through `flushSync`, so flipping the stage
			// first would commit the result zone while it was still empty.
			this.raidSimResultsManager.setSimResult(simResult);
			this.resultsViewer.showResult();
		});

		this.sim.waitForInit().then(() => {
			repairTargetInputs(this.sim.encounter);
			watchTargetDummies(this.player, this.sim);
		});

		this.bt = new BulkTab(this);

		// Declarative behaviour slots. These run last, exactly where a spec
		// subclass' constructor body used to run: after every model the React tree
		// reads exists, but still synchronously, so `loadSettings()` (queued
		// on waitForInit above) already sees `this.reforger`. Order is observable:
		// a `features` slot's sidebar button lands above the reforge button.
		for (const feature of config.features || []) {
			feature(this);
		}
		if (config.reforge) {
			this.reforgeOptions = typeof config.reforge === 'function' ? config.reforge(this) : config.reforge;
			this.reforger = createReforgeOptimizer(this.sim, this.player, {
				...this.reforgeOptions,
				defaults: this.individualConfig.defaults,
				epStats: this.individualConfig.epStats,
			});
			this.sidebar.add({
				id: 'suggest-reforges',
				render: () => createElement(ReforgeSidebarGroup, { model: this.reforger!, options: this.reforgeOptions ?? undefined }),
			});
		}
		for (const derived of config.derivedSettings || []) {
			derived.apply(this.player, this.sim);
			derived.subscribe(this.player, this.sim)(() => derived.apply(this.player, this.sim));
		}
	}

	get resultsViewer(): ResultsPanelHandle {
		return this.resultsPanel;
	}

	// `config` and `individualConfig` are the same object; `SimHost` only narrows what features see of it.
	get config(): IndividualSimUIConfig<SpecType> {
		return this.individualConfig;
	}

	addWarning(warning: SimWarning) {
		this.warnings.add(warning);
	}

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
		return reportSimCrash(error, {
			crashReport: this.crashReport,
			toLink: () => this.toLink(),
			getLastUsedRngSeed: () => this.sim.getLastUsedRngSeed(),
		});
	}

	applyDefaultConfigOptions(config: IndividualSimUIConfig<SpecType>): IndividualSimUIConfig<SpecType> {
		config.otherInputs.inputs = [OtherInputs.ChallengeMode, ...config.otherInputs.inputs];

		return config;
	}

	private loadSettings() {
		// Autosave sources: the sim aggregate (settings + raid + encounter, no
		// server-derived state) plus the reforge settings.
		const autosaveSubscribe = this.reforger
			? subscribeAll([subscribeSimChange(this.sim), subscribeReforgeChange(this.reforger.settings)])
			: subscribeSimChange(this.sim);
		loadIndividualSettings(this, {
			storageKey: this.getSettingsStorageKey(),
			player: this.player,
			autosaveSubscribe,
			statWeightSettings: this.statWeightActionSettings,
		});
	}

	applyEmptyAplRotation() {
		applyEmptyAplRotation(this.player);
	}

	static updateProtoVersion(settingsProto: IndividualSimSettings) {
		updateIndividualSimProtoVersion(settingsProto);
	}

	applyDefaults() {
		applyIndividualDefaults(this);
	}

	toProto(exportCategories?: Array<SimSettingCategories>): IndividualSimSettings {
		return individualSimSettingsToProto(this.serializationContext(), exportCategories);
	}

	toLink(): string {
		return createLink(this);
	}

	fromProto(settings: IndividualSimSettings, includeCategories?: Array<SimSettingCategories>) {
		applyIndividualSimSettings(this.serializationContext(), settings, includeCategories);
	}

	getSavedGearStorageKey(): string {
		return this.getStorageKey(SAVED_GEAR_STORAGE_KEY);
	}

	getSavedEPWeightsStorageKey(): string {
		return this.getStorageKey(SAVED_EP_WEIGHTS_STORAGE_KEY);
	}

	getSavedRotationStorageKey(): string {
		return this.getStorageKey(SAVED_ROTATION_STORAGE_KEY);
	}

	getSavedSettingsStorageKey(): string {
		return this.getStorageKey(SAVED_SETTINGS_STORAGE_KEY);
	}

	getSavedTalentsStorageKey(): string {
		return this.getStorageKey(SAVED_TALENTS_STORAGE_KEY);
	}

	getStorageKey(keyPart: string): string {
		return specStorageKey(this.player.getPlayerSpec(), keyPart);
	}
}
