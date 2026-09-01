// Field-level store subscriptions for pickers (InputConfig.storeSubscribe).
// Each returns (onChange) => unsubscribe. All are batch-gated (see batch.ts):
// inside batch() they fire once at the end with final state.
import type { Encounter } from '../encounter';
import type { Party } from '../party';
import type { Player } from '../player';
import type { Raid } from '../raid';
import type { Sim } from '../sim';
import { subscribeGated } from './batch';
import type { ReforgeSettings } from './reforge_settings';
import type { EncounterSlice, PlayerField, RaidSlice, ReforgeField, SimSettingsSlice, SimState, UISlice } from './sim_store';
import { PLAYER_FIELDS } from './sim_store';
import type { StatWeightActionSettings } from './stat_weight_settings';

// Fields whose change counts as a "player settings change" for aggregate
// subscribers (mirrors the old Player.changeEmitter composition): everything
// the user edits. Server-derived `currentStats` is excluded — including it
// would make stat recomputation re-trigger itself.
export const PLAYER_CHANGE_FIELDS = PLAYER_FIELDS.filter(f => f !== 'currentStats');

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

export type StoreSubscribe = (onChange: () => void) => () => void;

// Player fields subscribe to the field's version counter, which the facade
// bumps exactly when the legacy emitter would have fired.
export function subscribePlayerField(player: Player<any>, field: PlayerField): StoreSubscribe {
	return onChange => subscribeGated(player.sim.store.subscribe, (s: SimState) => s.players[player.storeKey]?.v[field], onChange);
}

export function subscribeSimField(sim: Sim, field: keyof SimSettingsSlice): StoreSubscribe {
	return onChange => subscribeGated(sim.store.subscribe, (s: SimState) => s.sim[field], onChange);
}

export function subscribeUiField(sim: Sim, field: keyof UISlice): StoreSubscribe {
	return onChange => subscribeGated(sim.store.subscribe, (s: SimState) => s.ui[field], onChange);
}

export function subscribeEncounterField(encounter: Encounter, field: keyof EncounterSlice): StoreSubscribe {
	return onChange => subscribeGated(encounter.sim.store.subscribe, (s: SimState) => s.encounter[field], onChange);
}

export function subscribeRaidField(raid: Raid, field: keyof RaidSlice): StoreSubscribe {
	return onChange => subscribeGated(raid.sim.store.subscribe, (s: SimState) => s.raid[field], onChange);
}

// ---------------------------------------------------------------------------
// Aggregate subscriptions ("anything in X changed"). Player membership uses
// version tuples (PLAYER_CHANGE_FIELDS) so server-derived state never counts
// as a change; slice-level objects are replace-on-write, so reference equality
// works for the rest. A batch touching several fields fires once.

export function shallowArrayEquals(a: ReadonlyArray<unknown>, b: ReadonlyArray<unknown>): boolean {
	return a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
}

type PartyTuple = Array<unknown>;
export function partyTuple(s: SimState, index: number): PartyTuple {
	const row = s.raid.composition[index] ?? [];
	return [row, s.raid.partyBuffs[index], ...flattenKeys(row.map(key => (key == null ? null : playerChangeKey(s, key))))];
}

export function subscribePlayerChange(player: Player<any>): StoreSubscribe {
	return onChange => subscribeGated(player.sim.store.subscribe, (s: SimState) => playerChangeKey(s, player.storeKey) ?? [], onChange, shallowArrayEquals);
}

// Party = its composition row, its buffs, and each member's player slice.
export function subscribePartyChange(party: Party): StoreSubscribe {
	return onChange => subscribeGated(party.sim.store.subscribe, (s: SimState) => partyTuple(s, party.getIndex()), onChange, shallowArrayEquals);
}

// Raid = the raid slice (buffs/debuffs/tanks/dummies/numActiveParties/
// partyBuffs/composition) plus every member's player slice.
export function raidTuple(s: SimState): Array<unknown> {
	return [s.raid, ...flattenKeys(s.raid.composition.flat().map(key => (key == null ? null : playerChangeKey(s, key))))];
}

export function subscribeRaidChange(raid: Raid): StoreSubscribe {
	return onChange =>
		subscribeGated(
			raid.sim.store.subscribe,
			raidTuple,
			onChange,
			shallowArrayEquals,
		);
}

// Raid composition in the broad sense: who is in which slot AND how many
// parties are active (getActivePlayers depends on both).
export function subscribeRaidComp(raid: Raid): StoreSubscribe {
	return onChange =>
		subscribeGated(raid.sim.store.subscribe, (s: SimState) => [s.raid.composition, s.raid.numActiveParties], onChange, shallowArrayEquals);
}

// Everything the character-stats computation depends on (raid + encounter),
// as ONE selector so a batch touching both recomputes once.
export function subscribeStatsInputs(sim: Sim): StoreSubscribe {
	return onChange => subscribeGated(sim.store.subscribe, (s: SimState) => [...raidTuple(s), s.encounter], onChange, shallowArrayEquals);
}

export function subscribeEncounterChange(encounter: Encounter): StoreSubscribe {
	return onChange => subscribeGated(encounter.sim.store.subscribe, (s: SimState) => s.encounter, onChange);
}

// Sim settings + UI flags (legacy Sim.settingsChangeEmitter).
export function subscribeSimSettingsChange(sim: Sim): StoreSubscribe {
	return onChange => subscribeGated(sim.store.subscribe, simSettingsKey, onChange, shallowArrayEquals);
}

// Mirrors the old Sim.changeEmitter: settings + raid + encounter. Server-derived
// state (currentStats, metadata, rng seed) and the reforge / stat-weight slices
// are NOT included — subscribe to those explicitly where needed.
export function subscribeSimChange(sim: Sim): StoreSubscribe {
	return onChange =>
		subscribeGated(sim.store.subscribe, (s: SimState) => [...simSettingsKey(s), s.encounter, ...raidTuple(s)], onChange, shallowArrayEquals);
}

// Party buffs for one party (PartyBuffs is an empty proto in MoP, but the
// picker binding still exists).
export function subscribePartyBuffs(party: Party): StoreSubscribe {
	return onChange => subscribeGated(party.sim.store.subscribe, (s: SimState) => s.raid.partyBuffs[party.getIndex()], onChange);
}

// Composes several subscriptions into one (an "any of these changed" source
// on the picker side). The listener may fire once per changed source.
export function subscribeAll(subs: Array<StoreSubscribe>): StoreSubscribe {
	return onChange => {
		const unsubs = subs.map(sub => sub(onChange));
		return () => unsubs.forEach(u => u());
	};
}

// Reforge-optimizer settings (per player; see ReforgeSettings).
export function subscribeReforgeField(settings: ReforgeSettings, field: ReforgeField): StoreSubscribe {
	return onChange => subscribeGated(settings.store.subscribe, (s: SimState) => s.reforge[settings.storeKey]?.v[field], onChange);
}

export function subscribeReforgeChange(settings: ReforgeSettings): StoreSubscribe {
	return onChange => subscribeGated(settings.store.subscribe, (s: SimState) => s.reforge[settings.storeKey], onChange);
}

// Stat-weight modal settings (per player).
export function subscribeStatWeightsChange(settings: StatWeightActionSettings): StoreSubscribe {
	return onChange => subscribeGated(settings.store.subscribe, (s: SimState) => s.statWeights[settings.storeKey]?.version, onChange);
}

// Unit metadata (spells/auras) refreshed after a compute-stats round trip.
export function subscribeUnitMetadata(sim: Sim): StoreSubscribe {
	return onChange => subscribeGated(sim.store.subscribe, (s: SimState) => s.sim.metadataVersion, onChange);
}

// Bulk tab state (per player). `owner` is the BulkTab (or anything exposing
// the player's sim + storeKey).
export interface BulkOwner {
	readonly sim: Sim;
	readonly storeKey: number;
}
export function subscribeBulkField(owner: BulkOwner, field: 'settings' | 'items'): StoreSubscribe {
	return onChange => subscribeGated(owner.sim.store.subscribe, (s: SimState) => s.bulk[owner.storeKey]?.v[field], onChange);
}
export function subscribeBulkChange(owner: BulkOwner): StoreSubscribe {
	return onChange => subscribeGated(owner.sim.store.subscribe, (s: SimState) => s.bulk[owner.storeKey], onChange);
}
