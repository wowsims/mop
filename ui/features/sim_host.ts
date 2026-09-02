import type { ErrorOutcome, StatWeightsResult } from '@core/proto/api';
import type { Spec, Stat } from '@core/proto/common';
import type { IndividualSimSettings } from '@core/proto/ui';
import type { SimSettingCategories } from '@domain/constants/sim_settings';
import type { Player } from '@domain/player';
import type { SimResult } from '@domain/proto_utils/sim_result';
import type { RunSimOptions } from '@domain/sim';
import type { EventID } from '@domain/state/batch';
import type { StoreSubscribe } from '@domain/state/subscriptions';
import type { WorkerProgressCallback } from '@domain/worker_pool';
import type { SimUIHost } from '@ui-kit/sim_host';

import type { BulkTab } from './bulk/view/bulk_tab';
import type { ReforgeOptimizer } from './reforge/view/reforge_panel';
import type { ResultsViewer } from './results/view/results_viewer';
import type { IndividualSimUIConfig } from './spec_config';
import type { EpWeightsMenu } from './stat-weights/view/stat_weights_panel';

// Config for displaying a warning to the user whenever a condition is met.
export interface SimWarning {
	updateOn: StoreSubscribe;
	getContent: () => string | Array<string>;
}

export type ActionGroupItem = { label?: string; children?: Element; cssClass?: string; onClick?: (event: MouseEvent) => void };

// The slice of the sim shells (app/sim_ui.tsx, app/individual_sim_ui.tsx) that
// features reach for. Features must not name the shells themselves (see
// ui/README.md dependency direction); SimUI/IndividualSimUI implement these.
export interface SimHost extends SimUIHost {
	readonly rootElem: HTMLElement;
	readonly disabled: boolean;
	readonly config: { cssClass: string; cssScheme: string };
	readonly resultsViewer: ResultsViewer;
	readonly simTabContentsContainer: HTMLElement;
	addAction(label: string, cssClass: string, onClick: (event: MouseEvent) => void): HTMLButtonElement;
	addActionGroup(groups: ActionGroupItem[], groupOptions?: { cssClass?: string }): { group: HTMLDivElement; children: HTMLButtonElement[] };
	isIndividualSim(): boolean;
	runSim(onProgress: WorkerProgressCallback, options?: RunSimOptions): Promise<SimResult | ErrorOutcome | undefined>;
	runSimOnce(options?: RunSimOptions): Promise<SimResult | null | undefined>;
	handleCrash(error: any): Promise<void>;
}

export interface IndividualSimHost<SpecType extends Spec> extends SimHost {
	readonly player: Player<SpecType>;
	readonly individualConfig: IndividualSimUIConfig<SpecType>;
	readonly bt: BulkTab | null;
	reforger: ReforgeOptimizer | null;
	epWeightsModal: EpWeightsMenu | null;
	prevEpIterations: number;
	prevEpSimResult: StatWeightsResult | null;
	dpsRefStat: Stat | undefined;
	healRefStat: Stat | undefined;
	tankRefStat: Stat | undefined;
	applyEmptyAplRotation(eventID: EventID): void;
	toProto(exportCategories?: Array<SimSettingCategories>): IndividualSimSettings;
	fromProto(eventID: EventID, settings: IndividualSimSettings, includeCategories?: Array<SimSettingCategories>): void;
	getStorageKey(keyPart: string): string;
	getSavedEPWeightsStorageKey(): string;
}

// `instanceof IndividualSimUI` is not available to features (the shell lives in
// app/); narrow on the shell's own predicate instead.
export function isIndividualSimHost(simUI: SimHost): simUI is IndividualSimHost<any> {
	return simUI.isIndividualSim();
}
