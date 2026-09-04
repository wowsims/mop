// Persisted reforge-optimizer settings, extracted from the ReforgeOptimizer
// component (ui/features/reforge/view/reforge_panel.tsx) so the state surface is UI-free.
// Values live in the sim store (`reforge[player.storeKey]`) with per-field
// version counters; this class is the facade over that slice.
// Serialization lands in IndividualSimSettings.reforgeSettings.
import { ReforgeSettings as ReforgeSettingsProto } from '@generated/proto/api';
import { ItemSlot, Stat } from '@generated/proto/common';

import type { Player } from './player';
import { StatCap, Stats, UnitStat } from './proto_utils/stats';
import { batch } from './state/batch';
import { patchKeyed, REFORGE_FIELDS, ReforgeField, ReforgeSlice, seedKeyed, SimStore, zeroVersions } from './state/sim_store';
// Used to force a particular proc from trinkets like Matrix Restabilizer and Apparatus of Khaz'goroth.
export class RelativeStatCap {
	static relevantStats: Stat[] = [Stat.StatCritRating, Stat.StatHasteRating, Stat.StatMasteryRating];
	readonly forcedHighestStat: UnitStat;

	static hasRoRo(player: Player<any>): boolean {
		return player.getGear().hasTrinketFromOptions([95802, 94532, 96546, 96174, 96918]);
	}

	constructor(forcedHighestStat: Stat) {
		if (!RelativeStatCap.relevantStats.includes(forcedHighestStat)) {
			throw new Error('Forced highest stat must be either Crit, Haste, or Mastery!');
		}
		this.forcedHighestStat = UnitStat.fromStat(forcedHighestStat);
	}
}

// The subset of the per-spec defaults the settings model needs.
export interface ReforgeSettingsDefaults {
	statCaps?: Stats;
	softCapBreakpoints?: StatCap[];
	breakpointLimits?: Stats;
}

export class ReforgeSettings {
	private readonly player: Player<any>;
	private readonly defaults: ReforgeSettingsDefaults;
	readonly store: SimStore;
	readonly storeKey: number;

	// Derived from relativeStatCapStat + the player's gear; not persisted directly.
	relativeStatCap: RelativeStatCap | null = null;

	constructor(player: Player<any>, defaults: ReforgeSettingsDefaults, defaultRelativeStatCap?: Stat | null) {
		this.player = player;
		this.defaults = defaults;
		this.store = player.sim.store;
		this.storeKey = player.storeKey;

		// Seed the slice (emit-less, like the old field initializers).
		seedKeyed(this.store, 'reforge', this.storeKey, {
			statCaps: defaults.statCaps || new Stats(),
			breakpointLimits: new Stats(),
			useCustomEPValues: false,
			useSoftCapBreakpoints: true,
			softCapBreakpoints: [],
			includeGems: false,
			includeEOTBPGemSocket: false,
			freezeItemSlots: false,
			frozenItemSlots: [],
			undershootCaps: new Stats(),
			relativeStatCapStat: defaultRelativeStatCap ?? -1,
			relativeStatCapPrecision: 0.0001,
			v: zeroVersions(REFORGE_FIELDS),
		});
	}

	private get slice(): ReforgeSlice {
		return this.store.getState().reforge[this.storeKey];
	}

	// Writes `patch` and bumps the given counters in one store write. No bumps
	// = the old silent field assignment.
	private write(patch: Partial<Omit<ReforgeSlice, 'v'>>, bumps: ReadonlyArray<ReforgeField> = []) {
		patchKeyed(this.store, 'reforge', this.storeKey, patch, bumps);
	}

	// ---- field accessors (property-style, as before)
	get _statCaps(): Stats {
		return this.slice.statCaps;
	}
	get breakpointLimits(): Stats {
		return this.slice.breakpointLimits;
	}
	get useCustomEPValues(): boolean {
		return this.slice.useCustomEPValues;
	}
	get useSoftCapBreakpoints(): boolean {
		return this.slice.useSoftCapBreakpoints;
	}
	get softCapBreakpoints(): StatCap[] {
		return this.slice.softCapBreakpoints;
	}
	get includeGems(): boolean {
		return this.slice.includeGems;
	}
	get includeEOTBPGemSocket(): boolean {
		return this.slice.includeEOTBPGemSocket;
	}
	get freezeItemSlots(): boolean {
		return this.slice.freezeItemSlots;
	}
	// Snapshot view; mutate through setFrozenItemSlot(s).
	get frozenItemSlots(): Set<ItemSlot> {
		return new Set(this.slice.frozenItemSlots as ItemSlot[]);
	}
	get undershootCaps(): Stats {
		return this.slice.undershootCaps;
	}
	// Silent assignment (no emit), matching the old direct field write.
	set undershootCaps(value: Stats) {
		this.write({ undershootCaps: value });
	}
	get relativeStatCapStat(): number {
		return this.slice.relativeStatCapStat;
	}
	get relativeStatCapPrecision(): number {
		return this.slice.relativeStatCapPrecision;
	}

	setStatCaps(newStatCaps: Stats) {
		this.write({ statCaps: newStatCaps }, ['statCaps']);
	}

	get statCaps() {
		return this.useCustomEPValues ? this._statCaps : this.defaults.statCaps || new Stats();
	}

	setUseCustomEPValues(newUseCustomEPValues: boolean) {
		if (newUseCustomEPValues !== this.useCustomEPValues) {
			this.write({ useCustomEPValues: newUseCustomEPValues }, ['useCustomEPValues']);
		}
	}

	setUseSoftCapBreakpoints(newUseSoftCapBreakpoints: boolean) {
		if (newUseSoftCapBreakpoints !== this.useSoftCapBreakpoints) {
			this.write({ useSoftCapBreakpoints: newUseSoftCapBreakpoints }, ['useSoftCapBreakpoints']);
		}
	}

	setBreakpointLimits(newLimits: Stats) {
		this.write({ breakpointLimits: newLimits }, ['breakpointLimits']);
	}

	setSoftCapBreakpoints(newSoftCapBreakpoints: StatCap[]) {
		this.write({ softCapBreakpoints: newSoftCapBreakpoints }, ['softCapBreakpoints']);
	}
	setRelativeStatCap(newValue: number) {
		this.relativeStatCap = newValue === -1 || !RelativeStatCap.hasRoRo(this.player) ? null : new RelativeStatCap(newValue);
		this.write({ relativeStatCapStat: newValue }, ['relativeStatCapStat']);
	}
	setRelativeStatCapPrecision(newValue: number) {
		this.write({ relativeStatCapPrecision: newValue }, ['relativeStatCapPrecision']);
	}

	setIncludeGems(newValue: boolean) {
		if (this.includeGems !== newValue) {
			this.write({ includeGems: newValue }, ['includeGems']);
		}
	}

	setIncludeEOTBPGemSocket(newValue: boolean) {
		if (this.includeEOTBPGemSocket !== newValue) {
			this.write({ includeEOTBPGemSocket: newValue }, ['includeEOTBPGemSocket']);
		}
	}

	setFreezeItemSlots(newValue: boolean) {
		if (this.freezeItemSlots !== newValue) {
			this.write({ frozenItemSlots: [], freezeItemSlots: newValue }, ['freezeItemSlots']);
		}
	}

	setFrozenItemSlot(slot: ItemSlot, frozen: boolean) {
		if (this.getFrozenItemSlot(slot) !== frozen) {
			const next = new Set(this.slice.frozenItemSlots as ItemSlot[]);
			next[frozen ? 'add' : 'delete'](slot);
			this.write({ frozenItemSlots: [...next] }, ['freezeItemSlots']);
		}
	}

	// Sets all frozen item slots at once
	setFrozenItemSlots(slots: ItemSlot[]) {
		this.write({ frozenItemSlots: [...new Set(slots)] }, ['freezeItemSlots']);
	}

	getFrozenItemSlot(slot: ItemSlot): boolean {
		return (this.slice.frozenItemSlots as ItemSlot[]).includes(slot);
	}

	fromProto(proto: ReforgeSettingsProto) {
		batch(() => {
			this.setUseCustomEPValues(proto.useCustomEpValues);
			this.setStatCaps(Stats.fromProto(proto.statCaps));
			this.setUseSoftCapBreakpoints(proto.useSoftCapBreakpoints);
			this.setIncludeGems(proto.includeGems);
			this.setIncludeEOTBPGemSocket(proto.includeEotbGemSocket);
			this.setFreezeItemSlots(proto.freezeItemSlots);
			this.setFrozenItemSlots(proto.frozenItemSlots);
			this.setBreakpointLimits(Stats.fromProto(proto.breakpointLimits));
			if (proto.relativeStatCapStat) {
				this.setRelativeStatCap(UnitStat.fromProto(proto.relativeStatCapStat).getStat());
			}
			this.setRelativeStatCapPrecision(proto.relativeStatCapMipGap || 0.0001);
		});
	}

	toProto(): ReforgeSettingsProto {
		return ReforgeSettingsProto.create({
			useCustomEpValues: this.useCustomEPValues,
			useSoftCapBreakpoints: this.useSoftCapBreakpoints,
			includeGems: this.includeGems,
			includeEotbGemSocket: this.includeEOTBPGemSocket,
			freezeItemSlots: this.freezeItemSlots,
			frozenItemSlots: [...this.frozenItemSlots],
			breakpointLimits: this.breakpointLimits.toProto(),
			relativeStatCapStat: this.relativeStatCap?.forcedHighestStat.toProto(),
			relativeStatCapMipGap: this.relativeStatCap ? this.relativeStatCapPrecision : 0,
			statCaps: this.statCaps.toProto(),
		});
	}

	applyDefaults() {
		batch(() => {
			this.setUseCustomEPValues(false);
			this.setUseSoftCapBreakpoints(!!this.defaults.softCapBreakpoints?.length);
			this.setIncludeGems(false);
			this.setIncludeEOTBPGemSocket(false);
			this.setFreezeItemSlots(false);
			this.setStatCaps(this.defaults.statCaps || new Stats());
			this.setBreakpointLimits(this.defaults.breakpointLimits || new Stats());
			this.setSoftCapBreakpoints(this.defaults.softCapBreakpoints || []);
			this.setRelativeStatCap(this.relativeStatCapStat);
			this.setRelativeStatCapPrecision(0.0001);
		});
	}
}
