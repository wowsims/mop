// Field-level store subscriptions for pickers (InputConfig.storeSubscribe).
// Each returns (onChange) => unsubscribe. All are batch-gated (see batch.ts):
// inside batch() they fire once at the end with final state.
import { arrayEquals } from '../utils/collections';
import type { Encounter } from '../raid/encounter';
import type { Party } from '../raid/party';
import type { Player } from '../player/player';
import type { Raid } from '../raid/raid';
import type { ReforgeSettings } from '../settings/reforge_settings';
import type { Sim } from '../sim';
import type { StatWeightActionSettings } from '../settings/stat_weight_settings';
import { subscribeGated } from './batch';
import type {
	EncounterSlice,
	PlayerField,
	RaidSlice,
	ReforgeField,
	SimRunKind,
	SimSettingsSlice,
	SimState,
	SimStore,
	StatWeightsSlice,
	UISlice,
} from './sim_store';
import { PLAYER_FIELDS } from './sim_store';

// Fields whose change counts as a "player settings change" for aggregate
// subscribers (mirrors the old Player.changeEmitter composition): everything
// the user edits. Server-derived `currentStats` is excluded — including it
// would make stat recomputation re-trigger itself.
export const PLAYER_CHANGE_FIELDS = PLAYER_FIELDS.filter(f => f !== 'currentStats');

export const shallowArrayEquals = (a: ReadonlyArray<unknown>, b: ReadonlyArray<unknown>) => arrayEquals(a as Array<unknown>, b as Array<unknown>, Object.is);

// A subscription source. Sources built from a selector carry it, so
// subscribeAll can fold several into ONE selector (one fire per batch).
export interface StoreSubscribe {
	(onChange: () => void): () => void;
	readonly sel?: { store: SimStore; selector: (s: SimState) => unknown; equalityFn: (a: any, b: any) => boolean };
	/** Identifies a cached source, so `subscribeAll` can key a composition on its parts. Absent on a caller-built source. */
	readonly id?: number;
}

let nextSourceId = 0;

function fromSelector<U>(store: SimStore, selector: (s: SimState) => U, equalityFn: (a: U, b: U) => boolean = Object.is): StoreSubscribe {
	const sub = ((onChange: () => void) => subscribeGated(store.subscribe, selector, onChange, equalityFn)) as StoreSubscribe & {
		sel: StoreSubscribe['sel'];
		id: number;
	};
	sub.sel = { store, selector, equalityFn };
	sub.id = nextSourceId++;
	return sub;
}

// A source is a pure factory over (store, selector, equalityFn) — `subscribeGated` builds
// the per-subscriber state on each call — so one identity can serve every subscriber.
// React needs that identity to be stable: `useStoreSubscribe` re-subscribes whenever its
// source changes identity, so a source rebuilt per render resubscribes per render. Anchored
// on the owning facade, so a disposed player's sources are collected with it.
const sourceCache = new WeakMap<object, Map<string, StoreSubscribe>>();

function cached(owner: object, key: string, build: () => StoreSubscribe): StoreSubscribe {
	let byKey = sourceCache.get(owner);
	if (!byKey) sourceCache.set(owner, (byKey = new Map()));
	let source = byKey.get(key);
	if (!source) byKey.set(key, (source = build()));
	return source;
}

// Composes several sources into one "any of these changed" source. Selector
// sources on the same store become a single tuple selector, so a batch (or a
// single write) touching several of them notifies exactly once.
export function subscribeAll(subs: Array<StoreSubscribe>): StoreSubscribe {
	const ids = subs.map(sub => sub.id);
	if (subs.length && ids.every(id => id !== undefined)) return cached(subs[0], `all:${ids.join('|')}`, () => composeAll(subs));
	return composeAll(subs);
}

function composeAll(subs: Array<StoreSubscribe>): StoreSubscribe {
	const sels = subs.map(sub => sub.sel);
	const store = sels[0]?.store;
	if (store && sels.every(sel => sel?.store === store)) {
		return fromSelector(
			store,
			s => sels.map(sel => sel!.selector(s)),
			(a, b) => a.every((v, i) => sels[i]!.equalityFn(v, b[i])),
		);
	}
	return onChange => {
		const unsubs = subs.map(sub => sub(onChange));
		return () => unsubs.forEach(u => u());
	};
}

// ---------------------------------------------------------------------------
// Field subscriptions. Player/reforge fields watch a version counter, which the
// facade bumps exactly when the old emitter would have fired.

export function subscribePlayerField(player: Player<any>, field: PlayerField): StoreSubscribe {
	return cached(player, `field:${field}`, () => fromSelector(player.sim.store, s => s.players[player.storeKey]?.v[field]));
}

export function subscribeRunState(sim: Sim, kind: SimRunKind): StoreSubscribe {
	return cached(sim, `run:${kind}`, () =>
		fromSelector(
			sim.store,
			s => s.runs[kind],
			(a, b) => a.isRunning === b.isRunning && a.isAborting === b.isAborting,
		),
	);
}

export function subscribeSimField(sim: Sim, field: keyof SimSettingsSlice): StoreSubscribe {
	return cached(sim, `sim:${field}`, () => fromSelector(sim.store, s => s.sim[field]));
}

export function subscribeUiField(sim: Sim, field: keyof UISlice): StoreSubscribe {
	return cached(sim, `ui:${field}`, () => fromSelector(sim.store, s => s.ui[field]));
}

export function subscribeEncounterField(encounter: Encounter, field: keyof EncounterSlice): StoreSubscribe {
	return cached(encounter, `encounter:${field}`, () => fromSelector(encounter.sim.store, s => s.encounter[field]));
}

export function subscribeRaidField(raid: Raid, field: keyof RaidSlice): StoreSubscribe {
	return cached(raid, `raid:${field}`, () => fromSelector(raid.sim.store, s => s.raid[field]));
}

// ---------------------------------------------------------------------------
// Aggregate subscriptions ("anything in X changed"). Player membership uses
// version tuples (PLAYER_CHANGE_FIELDS) so server-derived state never counts
// as a change; slice-level objects are replace-on-write, so reference equality
// works for the rest.

// Version tuple for one player's settings (null if the slice is missing).
export function playerChangeKey(s: SimState, storeKey: number): Array<number> | null {
	const slice = s.players[storeKey];
	return slice ? PLAYER_CHANGE_FIELDS.map(f => slice.v[f]) : null;
}

function flattenKeys(keys: Array<Array<number> | null>): Array<unknown> {
	const out: Array<unknown> = [];
	keys.forEach(k => (k ? out.push(...k) : out.push(null)));
	return out;
}

// Domain-level sim settings (mirrors the old Sim.settingsChangeEmitter): the
// sim + ui slices minus the run-derived rng seed / metadata counters.
export function simSettingsKey(s: SimState): Array<unknown> {
	return [s.sim.iterations, s.sim.phase, s.sim.faction, s.sim.fixedRngSeed, s.sim.filters, s.ui];
}

export function partyTuple(s: SimState, index: number): Array<unknown> {
	const row = s.raid.composition[index] ?? [];
	return [row, s.raid.partyBuffs[index], ...flattenKeys(row.map(key => (key == null ? null : playerChangeKey(s, key))))];
}

// Raid = the raid slice (buffs/debuffs/tanks/dummies/numActiveParties/
// partyBuffs/composition) plus every member's player slice. Selectors run for
// every subscriber on every write, so the tuple is memoized per state object.
let lastRaidState: SimState | null = null;
let lastRaidTuple: Array<unknown> = [];
export function raidTuple(s: SimState): Array<unknown> {
	if (s !== lastRaidState) {
		lastRaidState = s;
		lastRaidTuple = [s.raid, ...flattenKeys(s.raid.composition.flat().map(key => (key == null ? null : playerChangeKey(s, key))))];
	}
	return lastRaidTuple;
}

export function subscribePlayerChange(player: Player<any>): StoreSubscribe {
	return cached(player, 'change', () => fromSelector(player.sim.store, s => playerChangeKey(s, player.storeKey) ?? [], shallowArrayEquals));
}

// Party = its composition row, its buffs, and each member's player slice.
export function subscribePartyChange(party: Party): StoreSubscribe {
	return cached(party, 'change', () => fromSelector(party.sim.store, s => partyTuple(s, party.getIndex()), shallowArrayEquals));
}

export function subscribeRaidChange(raid: Raid): StoreSubscribe {
	return cached(raid, 'change', () => fromSelector(raid.sim.store, raidTuple, shallowArrayEquals));
}

// Everything the character-stats computation depends on (raid + encounter).
export function subscribeStatsInputs(sim: Sim): StoreSubscribe {
	return subscribeAll([subscribeRaidChange(sim.raid), subscribeEncounterChange(sim.encounter)]);
}

export function subscribeEncounterChange(encounter: Encounter): StoreSubscribe {
	return cached(encounter, 'change', () => fromSelector(encounter.sim.store, s => s.encounter));
}

// Sim settings + UI flags (legacy Sim.settingsChangeEmitter).
export function subscribeSimSettingsChange(sim: Sim): StoreSubscribe {
	return cached(sim, 'settingsChange', () => fromSelector(sim.store, simSettingsKey, shallowArrayEquals));
}

// Mirrors the old Sim.changeEmitter: settings + raid + encounter. Server-derived
// state (currentStats, metadata, rng seed) and the reforge / stat-weight slices
// are NOT included — subscribe to those explicitly where needed.
export function subscribeSimChange(sim: Sim): StoreSubscribe {
	return cached(sim, 'change', () => fromSelector(sim.store, s => [...simSettingsKey(s), s.encounter, ...raidTuple(s)], shallowArrayEquals));
}

// Party buffs for one party (PartyBuffs is an empty proto in MoP, but the
// picker binding still exists).
export function subscribePartyBuffs(party: Party): StoreSubscribe {
	return cached(party, 'buffs', () => fromSelector(party.sim.store, s => s.raid.partyBuffs[party.getIndex()]));
}

// Reforge-optimizer settings (per player; see ReforgeSettings).
export function subscribeReforgeField(settings: ReforgeSettings, field: ReforgeField): StoreSubscribe {
	return cached(settings, `field:${field}`, () => fromSelector(settings.store, s => s.reforge[settings.storeKey]?.v[field]));
}

// Same slice, reached from the player rather than the per-model ReforgeSettings
// facade: the slice is keyed by `player.storeKey`, so a picker can name a reforge
// field without holding the facade.
export function subscribePlayerReforgeField(player: Player<any>, field: ReforgeField): StoreSubscribe {
	return cached(player, `reforge:${field}`, () => fromSelector(player.sim.store, s => s.reforge[player.storeKey]?.v[field]));
}

export function subscribeReforgeChange(settings: ReforgeSettings): StoreSubscribe {
	return cached(settings, 'change', () => fromSelector(settings.store, s => s.reforge[settings.storeKey]));
}

// Stat-weight modal settings (per player).
export function subscribeStatWeightsChange(settings: StatWeightActionSettings): StoreSubscribe {
	return cached(settings, 'change', () => fromSelector(settings.store, s => s.statWeights[settings.storeKey]?.v.settings));
}

export function subscribePlayerStatWeightsField(player: Player<any>, field: keyof StatWeightsSlice['v']): StoreSubscribe {
	return cached(player, `statWeights:${field}`, () => fromSelector(player.sim.store, s => s.statWeights[player.storeKey]?.v[field]));
}

// Unit metadata (spells/auras) refreshed after a compute-stats round trip.
export function subscribeUnitMetadata(sim: Sim): StoreSubscribe {
	return cached(sim, 'unitMetadata', () => fromSelector(sim.store, s => s.sim.metadataVersion));
}

// Bulk tab state (per player). `owner` is the player, or anything else
// exposing its sim + storeKey.
export interface BulkOwner {
	readonly sim: Sim;
	readonly storeKey: number;
}
export function subscribeBulkField(owner: BulkOwner, field: 'settings' | 'items'): StoreSubscribe {
	return cached(owner, `bulk:${field}`, () => fromSelector(owner.sim.store, s => s.bulk[owner.storeKey]?.v[field]));
}
export function subscribeBulkChange(owner: BulkOwner): StoreSubscribe {
	return subscribeAll([subscribeBulkField(owner, 'settings'), subscribeBulkField(owner, 'items')]);
}
