import { Player, PlayerConfig, registerSpecConfig as registerPlayerConfig } from '@domain/player';
import type { PresetBuild, PresetEncounter, PresetEpWeights, PresetGear, PresetItemSwap, PresetRotation, PresetSettings } from '@domain/presets/types';
import type { SpecOptions, SpecRotation } from '@domain/proto_utils/spec_types';
import type { StatMods, StatWrites } from '@domain/proto_utils/stats';
import { StatCap, Stats, UnitStat } from '@domain/proto_utils/stats';
import type { Sim } from '@domain/sim';
import type { StoreSubscribe } from '@domain/state/subscriptions';
import { APLRotation_Type as APLRotationType } from '@generated/proto/apl';
import {
	ConsumesSpec,
	Debuffs,
	EquipmentSpec,
	IndividualBuffs,
	ItemSlot,
	ItemSwap,
	PartyBuffs,
	Profession,
	PseudoStat,
	Race,
	RaidBuffs,
	Spec,
	Stat,
} from '@generated/proto/common';
import { SavedTalents } from '@generated/proto/ui';
import { ContentBlock } from '@ui-kit/content_block';
import * as IconInputs from '@ui-kit/icon_inputs';
import * as InputHelpers from '@ui-kit/input_helpers';
import { SavedDataConfig } from '@ui-kit/saved_data_manager';

import type { EncounterPickerConfig } from './encounter/view/encounter_picker';
import type { ReforgeOptimizerOptions } from './reforge/model/reforge_optimizer';
import type { IndividualSimHost, SimWarning } from './sim_host';

export type InputConfig<ModObject> =
	| InputHelpers.TypedBooleanPickerConfig<ModObject>
	| InputHelpers.TypedNumberPickerConfig<ModObject>
	| InputHelpers.TypedEnumPickerConfig<ModObject>;

export interface InputSection {
	tooltip?: string;
	inputs: Array<InputConfig<Player<any>>>;
}

// An extra settings-tab section, declared as data. Core renders it (see
// `SettingsTab.buildCustomSettingsSections`) with the same ContentBlock and
// picker construction path the standard sections use — a spec never builds DOM.
export interface CustomSection<SpecType extends Spec> {
	// Stable identifier. Doubles as the ContentBlock css class when `cssClass`
	// is not given.
	id: string;
	title: string;
	tooltip?: string;
	// Css class for the section's ContentBlock; this is what stylesheets hook on.
	cssClass?: string;
	// Hides the whole section when this evaluates to false, mirroring `showWhen`
	// on an individual input.
	when?: (player: Player<SpecType>) => boolean;
	// Icon pickers, rendered into a group container above `inputs`.
	iconInputs?: Array<IconInputs.IconInputConfig<Player<SpecType>, any>>;
	// Extra css class for that group container; the layout hook for the icon row.
	iconGroupCssClass?: string;
	// Non-icon pickers, same shape as `otherInputs.inputs`.
	inputs?: Array<InputConfig<Player<any>>>;
}

export interface OtherDefaults {
	profession1?: Profession;
	profession2?: Profession;
	distanceFromTarget?: number;
	channelClipDelay?: number;
	reactionTime?: number;
	highHpThreshold?: number;
	iterationCount?: number;
	race?: Race;
}

export interface IndividualSimUIConfig<SpecType extends Spec> extends PlayerConfig<SpecType> {
	// Override for required talent rows. If not specified, defaults to requiring all rows [0, 1, 2, 3, 4, 5]
	requiredTalentRows?: number[];
	// Additional css class to add to the root element.
	cssClass: string;
	// Used to generate schemed components. E.g. 'shaman', 'druid', 'raid'
	cssScheme: string;

	knownIssues?: Array<string>;
	warnings?: Array<(simUI: IndividualSimHost<SpecType>) => SimWarning>;
	consumableStats?: Array<Stat>;
	gemStats?: Array<Stat>;
	epStats: Array<Stat>;
	epPseudoStats?: Array<PseudoStat>;
	epReferenceStat: Stat;
	displayStats: Array<UnitStat>;
	modifyDisplayStats?: (player: Player<SpecType>) => StatMods;
	overwriteDisplayStats?: (player: Player<SpecType>) => StatWrites;

	// This can be used as a shorthand for setting "defaults".
	// Useful for when the defaults should be the same as the preset build options
	defaultBuild?: PresetBuild;
	defaults: {
		gear: EquipmentSpec;
		itemSwap?: ItemSwap;

		epWeights: Stats;
		// Used for Reforge Optimizer
		statCaps?: Stats;
		/**
		 * Allows specification of soft cap breakpoints for one or more stats.
		 *
		 * @remarks
		 * These function differently from the hard caps taken from the sim UI in a few ways:
		 *
		 * Firstly, the specified breakpoints are lower priority than hard caps, and
		 * evaluated only after the hard cap constraints have been solved first.
		 *
		 * Secondly, these constraints are evaluated in the order specified by the configuration
		 * Array rather than all at once. So once the hard caps have been respected, the
		 * closest breakpoint for the *first* listed soft capped stat is optimized against
		 * while ignoring any others. Then the solution is used to identify the closest
		 * breakpoint for the second listed stat (if present), etc.
		 */
		softCapBreakpoints?: StatCap[];
		breakpointLimits?: Stats;
		consumables: ConsumesSpec;
		talents: SavedTalents;
		specOptions: SpecOptions<SpecType>;

		raidBuffs: RaidBuffs;
		partyBuffs: PartyBuffs;
		individualBuffs: IndividualBuffs;

		debuffs: Debuffs;

		rotationType?: APLRotationType;
		simpleRotation?: SpecRotation<SpecType>;

		// Encounter applied by "Reset to Defaults" and on first load. Falls back to
		// the generic single-target dummy when unset.
		encounter?: PresetEncounter;

		other?: OtherDefaults;
	};

	playerInputs?: InputSection;
	playerIconInputs: Array<IconInputs.IconInputConfig<Player<SpecType>, any>>;
	petConsumeInputs?: Array<IconInputs.IconInputConfig<Player<SpecType>, any>>;
	rotationInputs?: InputSection;
	rotationIconInputs?: Array<IconInputs.IconInputConfig<Player<SpecType>, any>>;
	includeBuffDebuffInputs: Array<any>;
	excludeBuffDebuffInputs: Array<any>;
	otherInputs: InputSection;
	// Currently, many classes don't support item swapping, and only in certain slots.
	// So enable it only where it is supported.
	itemSwapSlots?: Array<ItemSlot>;

	// Extra settings-tab sections, as data (e.g. Shaman totems).
	sections?: Array<CustomSection<SpecType>>;
	/** @deprecated Declare `sections` instead — a spec should never build DOM. */
	customSections?: Array<(parentElem: HTMLElement, simUI: IndividualSimHost<SpecType>) => ContentBlock>;

	encounterPicker: EncounterPickerConfig;

	presets: {
		epWeights: Array<PresetEpWeights>;
		gear: Array<PresetGear>;
		talents: Array<SavedDataConfig<Player<SpecType>, SavedTalents>>;
		rotations: Array<PresetRotation>;
		encounters?: Array<PresetEncounter>;
		settings?: Array<PresetSettings>;
		builds?: Array<PresetBuild>;
		itemSwaps?: Array<PresetItemSwap>;
	};
}

// A setting whose value is derived from other settings (e.g. Monk stance from
// talents, DK AMS intake from the encounter). `apply` runs once at startup and
// again whenever `subscribe`'s source fires.
export interface DerivedSetting<SpecType extends Spec> {
	subscribe: (player: Player<SpecType>, sim: Sim) => StoreSubscribe;
	apply: (player: Player<SpecType>, sim: Sim) => void;
}

// The behaviour slots a spec declares on top of its config data — the four
// things a spec constructor used to do by hand. All optional: a spec that needs
// none of them declares none.
export interface SpecBehaviors<SpecType extends Spec> {
	// Wires the Reforge Optimizer. A function form receives the sim host, for
	// options that need to call back into it.
	reforge?: ReforgeOptimizerOptions | ((host: IndividualSimHost<SpecType>) => ReforgeOptimizerOptions);
	// Whether the player sims incoming healing. Defaults to `isTankSpec ||
	// isHealingSpec` from the spec's registry entry; set it only to override that.
	enableHealing?: boolean;
	derivedSettings?: Array<DerivedSetting<SpecType>>;
	// Spec-local escape hatch: anything else that needs constructing with the host.
	features?: Array<(host: IndividualSimHost<SpecType>) => unknown>;
}

// A whole spec as data. `ui/app/spec_entry.ts` loads one of these per page.
export interface SpecDefinition<SpecType extends Spec> extends IndividualSimUIConfig<SpecType>, SpecBehaviors<SpecType> {
	spec: SpecType;
}

// Identity function; exists purely so `ui/<class>/<spec>/spec.ts` gets the
// config checked against `SpecDefinition` without an `as` cast or a type
// annotation that would widen the literal spec type.
export function defineSpec<SpecType extends Spec>(def: SpecDefinition<SpecType>): SpecDefinition<SpecType> {
	return def;
}

export function registerSpecConfig<SpecType extends Spec>(spec: SpecType, config: IndividualSimUIConfig<SpecType>): IndividualSimUIConfig<SpecType> {
	registerPlayerConfig(spec, config);
	return config;
}

export const itemSwapEnabledSpecs: Array<any> = [];

export interface Settings {
	raidBuffs: RaidBuffs;
	partyBuffs: PartyBuffs;
	individualBuffs: IndividualBuffs;
	consumables: ConsumesSpec;
	race: Race;
	professions?: Array<Profession>;
}
