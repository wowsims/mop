import {
	Encounter as EncounterProto,
	MobType,
	PresetEncounter,
	PresetTarget,
	SpellSchool,
	Stat,
	Target as TargetProto,
	TargetInput,
} from '@generated/proto/common';

import * as Mechanics from './constants/mechanics';
import { CURRENT_API_VERSION } from './constants/other';
import { UnitMetadataList } from './player';
import { Stats } from './proto_utils/stats';
import { Sim } from './sim';
import { batch } from './state/batch';
import { EncounterSlice, SimStore } from './state/sim_store';
// Manages all the settings for an Encounter. State lives in the Zustand
// store's `encounter` slice.
export class Encounter {
	readonly sim: Sim;
	private readonly store: SimStore;

	targetsMetadata: UnitMetadataList;

	constructor(sim: Sim) {
		this.sim = sim;
		this.store = sim.store;
		// Seed the default target (initialization, not a change).
		this.store.setState(s => ({ encounter: { ...s.encounter, targets: [Encounter.defaultTargetProto()] } }));
		this.targetsMetadata = new UnitMetadataList();
	}

	private get enc(): EncounterSlice {
		return this.store.getState().encounter;
	}

	private set(patch: Partial<EncounterSlice>) {
		this.store.setState(s => ({ encounter: { ...s.encounter, ...patch } }));
	}

	// Read-only access. The returned protos are live objects — do NOT mutate
	// them; route all writes through setTargets/modifyTarget so change events fire.
	get primaryTarget(): TargetProto {
		return this.enc.targets[0];
	}

	getTargets(): Array<TargetProto> {
		return this.enc.targets;
	}

	getTarget(index: number): TargetProto | undefined {
		return this.enc.targets[index];
	}

	setTargets(newTargets: Array<TargetProto>) {
		// The old setter notified unconditionally; a same-reference write is
		// stored as a fresh array so subscribers still see a change.
		this.set({ targets: newTargets === this.enc.targets ? newTargets.slice() : newTargets });
	}

	// Target mutation with a single change event — the write path for the
	// encounter picker's per-field edits. Replace-on-write: the callback gets a
	// clone, which then replaces the original in a new targets array.
	modifyTarget(index: number, modify: (target: TargetProto) => void) {
		const targets = this.enc.targets.slice();
		if (!targets[index]) {
			// Old behavior for a missing target: the write went to a throwaway
			// object and the change event still fired.
			this.set({ targets });
			return;
		}
		const clone = TargetProto.clone(targets[index]);
		modify(clone);
		targets[index] = clone;
		this.set({ targets });
	}

	getDurationVariation(): number {
		return this.enc.durationVariation;
	}
	setDurationVariation(newDuration: number) {
		if (newDuration == this.enc.durationVariation) return;
		this.set({ durationVariation: newDuration });
	}

	getDuration(): number {
		return this.enc.duration;
	}
	setDuration(newDuration: number) {
		if (newDuration == this.enc.duration) return;
		this.set({ duration: newDuration });
	}

	getExecuteProportion20(): number {
		return this.enc.executeProportion20;
	}
	setExecuteProportion20(newExecuteProportion20: number) {
		if (newExecuteProportion20 == this.enc.executeProportion20) return;
		this.set({ executeProportion20: newExecuteProportion20 });
	}
	getExecuteProportion25(): number {
		return this.enc.executeProportion25;
	}
	setExecuteProportion25(newExecuteProportion25: number) {
		if (newExecuteProportion25 == this.enc.executeProportion25) return;
		this.set({ executeProportion25: newExecuteProportion25 });
	}
	getExecuteProportion35(): number {
		return this.enc.executeProportion35;
	}
	setExecuteProportion35(newExecuteProportion35: number) {
		if (newExecuteProportion35 == this.enc.executeProportion35) return;
		this.set({ executeProportion35: newExecuteProportion35 });
	}
	getExecuteProportion45(): number {
		return this.enc.executeProportion45;
	}
	setExecuteProportion45(newExecuteProportion45: number) {
		if (newExecuteProportion45 == this.enc.executeProportion45) return;
		this.set({ executeProportion45: newExecuteProportion45 });
	}
	getExecuteProportion90(): number {
		return this.enc.executeProportion90;
	}
	setExecuteProportion90(newExecuteProportion90: number) {
		if (newExecuteProportion90 == this.enc.executeProportion90) return;
		this.set({ executeProportion90: newExecuteProportion90 });
	}
	getUseHealth(): boolean {
		return this.enc.useHealth;
	}
	setUseHealth(newUseHealth: boolean) {
		if (newUseHealth == this.enc.useHealth) return;
		this.set({ useHealth: newUseHealth });
	}

	matchesPreset(preset: PresetEncounter): boolean {
		const targets = this.enc.targets;
		return preset.targets.length == targets.length && targets.every((t, i) => TargetProto.equals(t, preset.targets[i].target));
	}

	applyPreset(preset: PresetEncounter) {
		this.set({ targets: preset.targets.map(presetTarget => presetTarget.target || TargetProto.create()) });
	}

	applyPresetTarget(preset: PresetTarget, index: number) {
		const targets = this.enc.targets.slice();
		targets[index] = preset.target || TargetProto.create();
		this.set({ targets });
	}

	toProto(): EncounterProto {
		const enc = this.enc;
		return EncounterProto.create({
			duration: enc.duration,
			durationVariation: enc.durationVariation,
			executeProportion20: enc.executeProportion20,
			executeProportion25: enc.executeProportion25,
			executeProportion35: enc.executeProportion35,
			executeProportion45: enc.executeProportion45,
			executeProportion90: enc.executeProportion90,
			useHealth: enc.useHealth,
			targets: enc.targets,
			apiVersion: CURRENT_API_VERSION,
		});
	}

	fromProto(proto: EncounterProto) {
		// Fix out-of-date protos before importing
		Encounter.updateProtoVersion(proto);

		batch(() => {
			this.setDuration(proto.duration);
			this.setDurationVariation(proto.durationVariation);
			this.setExecuteProportion20(proto.executeProportion20);
			this.setExecuteProportion25(proto.executeProportion25);
			this.setExecuteProportion35(proto.executeProportion35);
			this.setExecuteProportion45(proto.executeProportion45);
			this.setExecuteProportion90(proto.executeProportion90);
			this.setUseHealth(proto.useHealth);
			// Clone so edits in the Advanced Encounter picker cannot mutate the
			// saved entry's (or the config default's) own target protos.
			this.setTargets(proto.targets.map(t => TargetProto.clone(t)));
		});
	}

	applyDefaults() {
		this.fromProto(Encounter.defaultEncounterProto());
	}

	static defaultEncounterProto(numTargets = 1): EncounterProto {
		return EncounterProto.create({
			duration: 300,
			durationVariation: 60,
			executeProportion20: 0.2,
			executeProportion25: 0.25,
			executeProportion35: 0.35,
			executeProportion45: 0.45,
			executeProportion90: 0.9,
			targets: Array.from({ length: numTargets }, () => Encounter.defaultTargetProto()),
			apiVersion: CURRENT_API_VERSION,
		});
	}

	static defaultTargetProto(): TargetProto {
		// Copy default raid target used as fallback for missing DB.
		// https://github.com/wowsims/mop/blob/3570c4fcf1a4e2cd81926019d4a1b3182f613de1/sim/encounters/register_all.go#L24
		return TargetProto.create({
			id: 31146,
			name: 'Raid Target',
			level: Mechanics.BOSS_LEVEL,
			mobType: MobType.MobTypeMechanical,
			stats: Stats.fromMap({
				[Stat.StatArmor]: 24835,
				[Stat.StatHealth]: 120016403,
			}).asProtoArray(),
			minBaseDamage: 550000,
			damageSpread: 0.4,
			tankIndex: 0,
			swingSpeed: 2,
			suppressDodge: false,
			parryHaste: false,
			dualWield: false,
			dualWieldPenalty: false,
			spellSchool: SpellSchool.SpellSchoolPhysical,
			targetInputs: new Array<TargetInput>(0),
		});
	}

	static updateProtoVersion(proto: EncounterProto) {
		if (!(proto.apiVersion < CURRENT_API_VERSION)) {
			return;
		}
	}
}
