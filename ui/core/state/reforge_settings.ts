// Persisted reforge-optimizer settings, extracted from the ReforgeOptimizer
// component (suggest_reforges_action.tsx) so the state surface is UI-free.
// Values live in the sim store (`reforge[player.storeKey]`) with per-field
// version counters; this class is the facade over that slice.
// Serialization lands in IndividualSimSettings.reforgeSettings.
import { Player } from '../player';
import { ReforgeSettings as ReforgeSettingsProto } from '../proto/api';
import { ItemSlot, Stat } from '../proto/common';
import { StatCap, Stats, UnitStat } from '../proto_utils/stats';
import { batch,EventID } from '../state/batch';
import { REFORGE_FIELDS, ReforgeField, ReforgeSlice, SimStore } from './sim_store';
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

		// Seed the slice (plain setState: emit-less, like the old field initializers).
		const zeroVersions = Object.fromEntries(REFORGE_FIELDS.map(f => [f, 0])) as Record<ReforgeField, number>;
		const seed: ReforgeSlice = {
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
			v: zeroVersions,
		};
		this.store.setState(s => ({ reforge: { ...s.reforge, [this.storeKey]: seed } }));


	}

	private get slice(): ReforgeSlice {
		return this.store.getState().reforge[this.storeKey];
	}

	// Writes a field and bumps its version (= the old "assign + emit").
	private patch(eventID: EventID, field: ReforgeField, value: unknown) {
		this.store.setState(s => {
				const r = s.reforge[this.storeKey];
				return { reforge: { ...s.reforge, [this.storeKey]: { ...r, [field]: value, v: { ...r.v, [field]: r.v[field] + 1 } } } };
			});
	}

	// Writes without bumping (= the old silent field assignment).
	private write(patch: Partial<ReforgeSlice>) {
		this.store.setState(s => ({ reforge: { ...s.reforge, [this.storeKey]: { ...s.reforge[this.storeKey], ...patch } } }));
	}

	// Bumps a version without changing values (= the old bare emit).
	private bump(eventID: EventID, field: ReforgeField) {
		this.store.setState(s => {
				const r = s.reforge[this.storeKey];
				return { reforge: { ...s.reforge, [this.storeKey]: { ...r, v: { ...r.v, [field]: r.v[field] + 1 } } } };
			});
	}

	// ---- field accessors (property-style, as before)
	get _statCaps(): Stats {
		return this.slice.statCaps as Stats;
	}
	get breakpointLimits(): Stats {
		return this.slice.breakpointLimits as Stats;
	}
	get useCustomEPValues(): boolean {
		return this.slice.useCustomEPValues;
	}
	get useSoftCapBreakpoints(): boolean {
		return this.slice.useSoftCapBreakpoints;
	}
	get softCapBreakpoints(): StatCap[] {
		return this.slice.softCapBreakpoints as StatCap[];
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
		return this.slice.undershootCaps as Stats;
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

	setStatCaps(eventID: EventID, newStatCaps: Stats) {
		this.patch(eventID, 'statCaps', newStatCaps);
	}

	get statCaps() {
		return this.useCustomEPValues ? this._statCaps : this.defaults.statCaps || new Stats();
	}

	setUseCustomEPValues(eventID: EventID, newUseCustomEPValues: boolean) {
		if (newUseCustomEPValues !== this.useCustomEPValues) {
			this.patch(eventID, 'useCustomEPValues', newUseCustomEPValues);
		}
	}

	setUseSoftCapBreakpoints(eventID: EventID, newUseSoftCapBreakpoints: boolean) {
		if (newUseSoftCapBreakpoints !== this.useSoftCapBreakpoints) {
			this.patch(eventID, 'useSoftCapBreakpoints', newUseSoftCapBreakpoints);
		}
	}

	setBreakpointLimits(eventID: EventID, newLimits: Stats) {
		this.patch(eventID, 'breakpointLimits', newLimits);
	}

	setSoftCapBreakpoints(eventID: EventID, newSoftCapBreakpoints: StatCap[]) {
		this.patch(eventID, 'softCapBreakpoints', newSoftCapBreakpoints);
	}
	setRelativeStatCap(eventID: EventID, newValue: number) {
		this.write({ relativeStatCapStat: newValue });
		if (newValue === -1 || !RelativeStatCap.hasRoRo(this.player)) {
			this.relativeStatCap = null;
		} else {
			this.relativeStatCap = new RelativeStatCap(newValue);
		}
		this.bump(eventID, 'relativeStatCapStat');
	}
	setRelativeStatCapPrecision(eventID: EventID, newValue: number) {
		this.patch(eventID, 'relativeStatCapPrecision', newValue);
	}

	setIncludeGems(eventID: EventID, newValue: boolean) {
		if (this.includeGems !== newValue) {
			this.patch(eventID, 'includeGems', newValue);
		}
	}

	setIncludeEOTBPGemSocket(eventID: EventID, newValue: boolean) {
		if (this.includeEOTBPGemSocket !== newValue) {
			this.patch(eventID, 'includeEOTBPGemSocket', newValue);
		}
	}

	setFreezeItemSlots(eventID: EventID, newValue: boolean) {
		if (this.freezeItemSlots !== newValue) {
			this.write({ frozenItemSlots: [] });
			this.patch(eventID, 'freezeItemSlots', newValue);
		}
	}

	setFrozenItemSlot(eventID: EventID, slot: ItemSlot, frozen: boolean) {
		if (this.getFrozenItemSlot(slot) !== frozen) {
			const next = new Set(this.slice.frozenItemSlots as ItemSlot[]);
			next[frozen ? 'add' : 'delete'](slot);
			this.write({ frozenItemSlots: [...next] });
			this.bump(eventID, 'freezeItemSlots');
		}
	}

	// Sets all frozen item slots at once
	setFrozenItemSlots(eventID: EventID, slots: ItemSlot[]) {
		this.write({ frozenItemSlots: [...new Set(slots)] });
		this.bump(eventID, 'freezeItemSlots');
	}

	getFrozenItemSlot(slot: ItemSlot): boolean {
		return (this.slice.frozenItemSlots as ItemSlot[]).includes(slot);
	}

	fromProto(eventID: EventID, proto: ReforgeSettingsProto) {
		batch(() => {
			this.setUseCustomEPValues(eventID, proto.useCustomEpValues);
			this.setStatCaps(eventID, Stats.fromProto(proto.statCaps));
			this.setUseSoftCapBreakpoints(eventID, proto.useSoftCapBreakpoints);
			this.setIncludeGems(eventID, proto.includeGems);
			this.setIncludeEOTBPGemSocket(eventID, proto.includeEotbGemSocket);
			this.setFreezeItemSlots(eventID, proto.freezeItemSlots);
			this.setFrozenItemSlots(eventID, proto.frozenItemSlots);
			this.setBreakpointLimits(eventID, Stats.fromProto(proto.breakpointLimits));
			if (proto.relativeStatCapStat) {
				this.setRelativeStatCap(eventID, UnitStat.fromProto(proto.relativeStatCapStat).getStat());
			}
			this.setRelativeStatCapPrecision(eventID, proto.relativeStatCapMipGap || 0.0001);
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

	applyDefaults(eventID: EventID) {
		batch(() => {
			this.setUseCustomEPValues(eventID, false);
			this.setUseSoftCapBreakpoints(eventID, !!this.defaults.softCapBreakpoints?.length);
			this.setIncludeGems(eventID, false);
			this.setIncludeEOTBPGemSocket(eventID, false);
			this.setFreezeItemSlots(eventID, false);
			this.setStatCaps(eventID, this.defaults.statCaps || new Stats());
			this.setBreakpointLimits(eventID, this.defaults.breakpointLimits || new Stats());
			this.setSoftCapBreakpoints(eventID, this.defaults.softCapBreakpoints || []);
			this.setRelativeStatCap(eventID, this.relativeStatCapStat);
			this.setRelativeStatCapPrecision(eventID, 0.0001);
		});
	}
}
