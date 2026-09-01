// The per-page Zustand store that is becoming the single source of truth for
// sim state. One Sim = one store; facade classes (Sim/Raid/Encounter/Player)
// write it via store.setState(...); consumers subscribe through the helpers in
// subscriptions.ts (batched by batch.ts) — there is no separate event system.
//
// Slices are added here as each facade is converted; a slice absent from this
// file still lives in its class.
import { subscribeWithSelector } from 'zustand/middleware';
import { createStore } from 'zustand/vanilla';

import { CURRENT_PHASE } from '../constants/other';
import { Debuffs, Faction, PartyBuffs, RaidBuffs, Target as TargetProto, UnitReference } from '../proto/common';
import { DatabaseFilters } from '../proto/ui';

// Presentation flags (owned by UISettings).
export interface UISlice {
	showDamageMetrics: boolean;
	showThreatMetrics: boolean;
	showHealingMetrics: boolean;
	showExperimental: boolean;
	wasmConcurrency: number;
	showQuickSwap: boolean;
	showEPValues: boolean;
	language: string;
}

// Encounter settings (owned by Encounter). `targets` is replace-on-write:
// Encounter.modifyTarget/setTargets store a new array, and the pickers copy
// before mutating, so subscribers can use reference equality.
export interface EncounterSlice {
	duration: number;
	durationVariation: number;
	executeProportion20: number;
	executeProportion25: number;
	executeProportion35: number;
	executeProportion45: number;
	executeProportion90: number;
	useHealth: boolean;
	targets: Array<TargetProto>;
}

// Raid-wide settings (owned by Raid; partyBuffs entries owned by each Party).
// Protos are replace-on-write (setters store clones), so subscribers use
// reference equality.
export interface RaidSlice {
	buffs: RaidBuffs;
	debuffs: Debuffs;
	tanks: Array<UnitReference>;
	targetDummies: number;
	numActiveParties: number;
	// One entry per party; length equals MAX_NUM_PARTIES (5).
	partyBuffs: Array<PartyBuffs>;
	// Player storeKeys per party slot (5×5), null = empty. Replace-on-write
	// (outer and inner arrays) so party/raid composition selectors can use
	// reference equality. The Party↔Player object graph stays class-side.
	composition: Array<Array<number | null>>;
}

// Domain-level sim settings (owned by Sim).
export interface SimSettingsSlice {
	iterations: number;
	phase: number;
	faction: Faction;
	fixedRngSeed: number;
	filters: DatabaseFilters;
	// Seed of the last sim run; written unconditionally per run, so
	// subscribers watch the version counter, not the value.
	lastUsedRngSeed: number;
	lastUsedRngSeedVersion: number;
	// Bumped when any unit's metadata (spells/auras) changed after a
	// compute-stats round trip; drives sim.unitMetadataEmitter.
	metadataVersion: number;
}

// Per-player settings. Values are the source of truth; the parallel `v`
// version counters are what subscribers watch: a setter bumps a field's
// version exactly when it counts as a change, so notification semantics
// survive reference-identity quirks (unconditional setters, forceUpdate,
// withChallengeMode returning `this`).
export interface PlayerSlice {
	name: string;
	race: number;
	profession1: number;
	profession2: number;
	buffs: unknown;
	consumables: unknown;
	bonusStats: unknown;
	gear: unknown;
	talentsString: string;
	glyphs: unknown;
	specOptions: unknown;
	reactionTime: number;
	channelClipDelay: number;
	inFrontOfTarget: boolean;
	distanceFromTarget: number;
	healingModel: unknown;
	challengeModeEnabled: boolean;
	epWeights: unknown;
	epRatios: Array<number>;
	currentStats: unknown;
	// Item-swap settings (facade: ItemSwapSettings).
	itemSwapEnabled: boolean;
	itemSwapGear: unknown;
	itemSwapBonusStats: unknown;
	// Stat-weight reference stats (persisted in the settings envelope).
	dpsRefStat: number | undefined;
	healRefStat: number | undefined;
	tankRefStat: number | undefined;
	v: Record<PlayerField, number>;
}

export const PLAYER_FIELDS = [
	'name',
	'race',
	'profession1',
	'profession2',
	'buffs',
	'consumables',
	'bonusStats',
	'gear',
	'talentsString',
	'glyphs',
	'specOptions',
	'reactionTime',
	'channelClipDelay',
	'inFrontOfTarget',
	'distanceFromTarget',
	'healingModel',
	'challengeModeEnabled',
	'epWeights',
	'epRatios',
	'currentStats',
	// Counter-only fields: the value stays class-side (aplRotation) or is
	// spread over several fields (itemSwap*, *RefStat); the counter is what
	// subscribers watch.
	'rotation',
	'itemSwap',
	'epRefStat',
] as const;
export type PlayerField = (typeof PLAYER_FIELDS)[number];

// Reforge-optimizer settings, one slice per player (keyed by storeKey).
// Values are the source of truth; `v` counters are what subscribers watch
// (bumped exactly where a change counts). The derived RelativeStatCap object
// stays on the ReforgeSettings facade.
export const REFORGE_FIELDS = [
	'includeGems',
	'includeEOTBPGemSocket',
	'statCaps',
	'useCustomEPValues',
	'useSoftCapBreakpoints',
	'softCapBreakpoints',
	'breakpointLimits',
	'freezeItemSlots',
	'undershootCaps',
	'relativeStatCapStat',
	'relativeStatCapPrecision',
] as const;
export type ReforgeField = (typeof REFORGE_FIELDS)[number];

export interface ReforgeSlice {
	statCaps: unknown;
	breakpointLimits: unknown;
	useCustomEPValues: boolean;
	useSoftCapBreakpoints: boolean;
	softCapBreakpoints: Array<unknown>;
	includeGems: boolean;
	includeEOTBPGemSocket: boolean;
	freezeItemSlots: boolean;
	frozenItemSlots: Array<number>;
	undershootCaps: unknown;
	relativeStatCapStat: number;
	relativeStatCapPrecision: number;
	v: Record<ReforgeField, number>;
}

// Stat-weight modal settings, one slice per player (keyed by storeKey).
export interface StatWeightsSlice {
	excludedStats: Array<number>;
	excludedPseudoStats: Array<number>;
	version: number;
}

// Bulk (batch) sim tab state per player: the persisted settings snapshot and
// the candidate item list, with version counters the tab bumps where it used
// to emit (see BulkTab.bump).
export interface BulkSlice {
	settings: unknown;
	items: Array<unknown>;
	v: { settings: number; items: number };
}

export interface SimState {
	reforge: { [storeKey: number]: ReforgeSlice };
	statWeights: { [storeKey: number]: StatWeightsSlice };
	bulk: { [storeKey: number]: BulkSlice };
	sim: SimSettingsSlice;
	ui: UISlice;
	encounter: EncounterSlice;
	raid: RaidSlice;
	players: { [storeKey: number]: PlayerSlice };
}

const initialState = (): SimState => ({
	sim: {
		iterations: 12500,
		phase: CURRENT_PHASE,
		faction: Faction.Alliance,
		fixedRngSeed: 0,
		filters: DatabaseFilters.create({ oneHandedWeapons: true, twoHandedWeapons: true }),
		lastUsedRngSeed: 0,
		lastUsedRngSeedVersion: 0,
		metadataVersion: 0,
	},
	ui: {
		showDamageMetrics: true,
		showThreatMetrics: false,
		showHealingMetrics: false,
		showExperimental: false,
		wasmConcurrency: 0,
		showQuickSwap: true,
		showEPValues: false,
		language: '',
	},
	raid: {
		buffs: RaidBuffs.create(),
		debuffs: Debuffs.create(),
		tanks: [],
		targetDummies: 0,
		numActiveParties: 5,
		// 5 = MAX_NUM_PARTIES (raid.ts); not imported to avoid a module cycle.
		partyBuffs: Array.from({ length: 5 }, () => PartyBuffs.create()),
		composition: Array.from({ length: 5 }, () => Array.from({ length: 5 }, () => null)),
	},
	// Seeded empty to avoid importing encounter.ts (cycle); the Encounter
	// constructor writes the default target on construction.
	encounter: {
		duration: 300,
		durationVariation: 60,
		executeProportion20: 0.2,
		executeProportion25: 0.25,
		executeProportion35: 0.35,
		executeProportion45: 0.45,
		executeProportion90: 0.9,
		useHealth: false,
		targets: [],
	},
	players: {},
	reforge: {},
	statWeights: {},
	bulk: {},
});

export type SimStore = ReturnType<typeof createSimStore>;

export function createSimStore() {
	return createStore<SimState>()(subscribeWithSelector(() => initialState()));
}
