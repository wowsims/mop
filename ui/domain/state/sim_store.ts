// The per-page Zustand store that is becoming the single source of truth for
// sim state. One Sim = one store; facade classes (Sim/Raid/Encounter/Player)
// write it via store.setState(...); consumers subscribe through the helpers in
// subscriptions.ts (batched by batch.ts) — there is no separate event system.
//
// Slices are added here as each facade is converted; a slice absent from this
// file still lives in its class.
import type { PlayerStats } from '@generated/proto/api';
import {
	ConsumesSpec,
	Debuffs,
	Faction,
	Glyphs,
	HealingModel,
	IndividualBuffs,
	PartyBuffs,
	RaidBuffs,
	Target as TargetProto,
	UnitReference,
} from '@generated/proto/common';
import { DatabaseFilters } from '@generated/proto/ui';
import { subscribeWithSelector } from 'zustand/middleware';
import { createStore } from 'zustand/vanilla';

import { CURRENT_PHASE } from '../constants/other';
import type { Gear, ItemSwapGear } from '../proto_utils/gear';
import type { StatCap, Stats } from '../proto_utils/stats';

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
	// compute-stats round trip; drives subscribeUnitMetadata().
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
	buffs: IndividualBuffs;
	consumables: ConsumesSpec;
	bonusStats: Stats;
	gear: Gear;
	talentsString: string;
	glyphs: Glyphs;
	// Per-spec proto; the generic is only known on Player<SpecType>.
	specOptions: unknown;
	reactionTime: number;
	channelClipDelay: number;
	inFrontOfTarget: boolean;
	distanceFromTarget: number;
	healingModel: HealingModel;
	challengeModeEnabled: boolean;
	epWeights: Stats;
	epRatios: Array<number>;
	currentStats: PlayerStats;
	// Item-swap settings (facade: ItemSwapSettings).
	itemSwapEnabled: boolean;
	itemSwapGear: ItemSwapGear;
	itemSwapBonusStats: Stats;
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
	'relativeStatCapStat',
	'relativeStatCapPrecision',
] as const;
export type ReforgeField = (typeof REFORGE_FIELDS)[number];

export interface ReforgeSlice {
	statCaps: Stats;
	breakpointLimits: Stats;
	useCustomEPValues: boolean;
	useSoftCapBreakpoints: boolean;
	softCapBreakpoints: Array<StatCap>;
	includeGems: boolean;
	includeEOTBPGemSocket: boolean;
	freezeItemSlots: boolean;
	frozenItemSlots: Array<number>;
	// Written silently by the optimizer (no counter, like the old bare field).
	undershootCaps: Stats;
	relativeStatCapStat: number;
	relativeStatCapPrecision: number;
	v: Record<ReforgeField, number>;
}

// Stat-weight modal settings, one slice per player (keyed by storeKey).
export interface StatWeightsSlice {
	excludedStats: Array<number>;
	excludedPseudoStats: Array<number>;
	v: { settings: number };
}

// Bulk (batch) sim tab: version counters the tab bumps where it used to emit
// (see BulkTab.bump). The values themselves stay on the tab.
export interface BulkSlice {
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

// ---------------------------------------------------------------------------
// Write helpers shared by the facades. Every logical change is ONE setState so
// subscribers see it once.

type UnkeyedSlice = 'sim' | 'ui' | 'encounter' | 'raid';
export function patchSlice<N extends UnkeyedSlice>(store: SimStore, slice: N, patch: Partial<SimState[N]>) {
	store.setState(s => ({ [slice]: { ...s[slice], ...patch } }) as Partial<SimState>);
}

type KeyedSlice = 'players' | 'reforge' | 'statWeights' | 'bulk';
type KeyedEntry<N extends KeyedSlice> = SimState[N][number];

export function zeroVersions<F extends string>(fields: ReadonlyArray<F>): Record<F, number> {
	return Object.fromEntries(fields.map(f => [f, 0])) as Record<F, number>;
}

// Seeds store[slice][key] (initialization, not a change).
export function seedKeyed<N extends KeyedSlice>(store: SimStore, slice: N, key: number, entry: KeyedEntry<N>) {
	store.setState(s => ({ [slice]: { ...s[slice], [key]: entry } }) as Partial<SimState>);
}

// Writes `patch` into store[slice][key] and bumps the given version counters.
// A bump with an empty patch is the old bare emit; a patch with no bumps is
// the old silent field write.
export function patchKeyed<N extends KeyedSlice>(
	store: SimStore,
	slice: N,
	key: number,
	patch: Partial<Omit<KeyedEntry<N>, 'v'>>,
	bumps: ReadonlyArray<keyof KeyedEntry<N>['v']> = [],
) {
	store.setState(s => {
		const cur = s[slice][key] as KeyedEntry<N>;
		const v = { ...cur.v } as Record<string, number>;
		for (const f of bumps) v[f as string] = (v[f as string] ?? 0) + 1;
		return { [slice]: { ...s[slice], [key]: { ...cur, ...patch, v } } } as Partial<SimState>;
	});
}

// Removes a player's entries from every keyed slice (Player.dispose).
export function deleteKeyed(store: SimStore, key: number) {
	store.setState(s => {
		const out: Partial<SimState> = {};
		for (const slice of ['players', 'reforge', 'statWeights', 'bulk'] as const) {
			const copy = { ...s[slice] } as Record<number, unknown>;
			delete copy[key];
			(out as Record<string, unknown>)[slice] = copy;
		}
		return out;
	});
}
