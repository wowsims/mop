import type { BulkTab } from '@features/bulk/bulk_tab';
import type { GearSelectorModalOpener } from '@features/gear/model/selector_modal_opener';
import type { ReforgeOptimizerModel } from '@features/reforge/model/reforge_optimizer';
import type { ResultChannel } from '@features/results/model/result_channel';
import type { ResultsPanelHandle } from '@features/results/model/results_panel_handle';
import type { ErrorOutcome, RaidSimRequest, RaidSimResult } from '@generated/proto/api';
import type { Spec, Stat } from '@generated/proto/common';
import type { IndividualSimSettings } from '@generated/proto/ui';
import type { SidebarRegistry } from '@ui-kit/sidebar_registry';
import type { SimTabRegistry } from '@ui-kit/tab_registry';

import type { SimSettingCategories } from './constants/sim_settings';
import type { Player } from './player/player';
import type { Gear } from './proto/gear';
import type { SimResult } from './proto/sim_result';
import type { RunSimOptions, Sim } from './sim';
import type { IndividualSimUIConfig } from './spec_config';
import type { StoreSubscribe } from './state/subscriptions';
import type { WorkerProgressCallback } from './workers/worker_pool';

// The slice of the sim shell (app/sim_ui.tsx) that ui-kit widgets reach for.
// ui-kit must not name the shell itself (see ui/README.md dependency direction).
export interface SimHeaderHost {
	readonly rootElem: HTMLElement;
	activateTab(className: string): void;
}

export interface SimUIHost {
	readonly sim: Sim;
	readonly simHeader: SimHeaderHost;
	readonly tabs: SimTabRegistry;
}

// Config for displaying a warning to the user whenever a condition is met.
export interface SimWarning {
	updateOn: StoreSubscribe;
	getContent: () => string | Array<string>;
}

// The slice of the sim shells (app/sim_ui.tsx, app/individual_sim_ui.tsx) that
// features reach for. Features must not name the shells themselves (see
// ui/README.md dependency direction); SimUI/IndividualSimUI implement these.
export interface SimHost extends SimUIHost {
	readonly rootElem: HTMLElement;
	readonly disabled: boolean;
	readonly config: { cssClass: string; cssScheme: string };
	readonly resultsViewer: ResultsPanelHandle;
	readonly simTabContentsContainer: HTMLElement;
	readonly sidebar: SidebarRegistry;
	runIndividualSim(onProgress: WorkerProgressCallback, options?: RunSimOptions): Promise<SimResult | ErrorOutcome | undefined>;
	runGearSim(gear: Gear, onProgress: WorkerProgressCallback, options?: RunSimOptions): Promise<[RaidSimRequest, RaidSimResult] | ErrorOutcome | undefined>;
	runSingleIteration(options?: RunSimOptions): Promise<SimResult | ErrorOutcome | undefined>;
	handleCrash(error: any): Promise<void>;
}

export interface IndividualSimHost<SpecType extends Spec> extends SimHost {
	readonly player: Player<SpecType>;
	readonly individualConfig: IndividualSimUIConfig<SpecType>;
	readonly bt: BulkTab | null;
	reforger: ReforgeOptimizerModel | null;
	epWeightsModal: { open(): void } | null;
	readonly gearSelectorModal: GearSelectorModalOpener | null;
	readonly itemSwapSelectorModal: GearSelectorModalOpener | null;
	readonly resultChannel: ResultChannel;
	dpsRefStat: Stat | undefined;
	healRefStat: Stat | undefined;
	tankRefStat: Stat | undefined;
	applyEmptyAplRotation(): void;
	toProto(exportCategories?: Array<SimSettingCategories>): IndividualSimSettings;
	fromProto(settings: IndividualSimSettings, includeCategories?: Array<SimSettingCategories>): void;
	getStorageKey(keyPart: string): string;
	getSavedEPWeightsStorageKey(): string;
	getSavedGearStorageKey(): string;
	getSavedTalentsStorageKey(): string;
	getSavedEncounterStorageKey(): string;
	getSavedRotationStorageKey(): string;
	getSavedSettingsStorageKey(): string;
}

// `instanceof IndividualSimUI` is not available to features (the shell lives in
// app/); narrow structurally instead. With the raid sim gone every host is an
// individual one, but features still must not name the shell.
export function isIndividualSimHost(simUI: SimHost): simUI is IndividualSimHost<any> {
	return 'player' in simUI;
}
