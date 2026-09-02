import { MAX_PARTY_SIZE, Party } from './party';
import { Player } from './player';
import { Raid as RaidProto } from './proto/api';
import { Class, Debuffs, RaidBuffs, UnitReference, UnitReference_Type as UnitType } from './proto/common';
import { Sim } from './sim';
import { batch, EventID } from './state/batch';
import type { RaidSlice } from './state/sim_store';
import { shallowArrayEquals } from './state/subscriptions';
import { sum } from './utils';
export const MAX_NUM_PARTIES = 5;

// Manages all the settings for a single Raid.
export class Raid {
	// Should always hold exactly MAX_NUM_PARTIES elements.
	private parties: Array<Party>;

	// Cached return value for getActivePlayers().
	private activePlayers: Array<Player<any>>;

	readonly sim: Sim;

	constructor(sim: Sim) {
		this.sim = sim;

		this.parties = [...Array(MAX_NUM_PARTIES).keys()].map(i => {
			return new Party(this, sim, i);
		});
		this.activePlayers = [];

		const subscribe = this.sim.store.subscribe;

		// Invalidate the active-players cache synchronously on any composition /
		// party-count write (ungated: readers inside the same batch see fresh
		// data; previously the cache was only cleared at thaw).
		subscribe(
			s => [s.raid.composition, s.raid.numActiveParties],
			() => {
				this.activePlayers = [];
			},
			{ equalityFn: shallowArrayEquals },
		);
	}

	private get raidState() {
		return this.sim.store.getState().raid;
	}

	private patchRaid(eventID: EventID, patch: Partial<RaidSlice>) {
		this.sim.store.setState(s => ({ raid: { ...s.raid, ...patch } }));
	}

	size(): number {
		return sum(this.parties.map(party => party.size()));
	}

	isEmpty(): boolean {
		return this.size() == 0;
	}

	getParties(): Array<Party> {
		// Make defensive copy.
		return this.parties.slice();
	}

	getParty(index: number): Party {
		return this.parties[index];
	}

	getPlayers(): Array<Player<any> | null> {
		return this.parties.map(party => party.getPlayers()).flat();
	}

	getPlayer(index: number): Player<any> | null {
		if (index === -1) return null;

		const party = this.parties[Math.floor(index / MAX_PARTY_SIZE)];
		return party.getPlayer(index % MAX_PARTY_SIZE);
	}

	getPlayerFromUnitReference(raidTarget: UnitReference | undefined, contextPlayer?: Player<any> | null): Player<any> | null {
		if (!raidTarget || raidTarget.type == UnitType.Unknown) {
			return null;
		} else if (raidTarget.type == UnitType.Player) {
			return this.getPlayer(raidTarget.index);
		} else if (raidTarget.type == UnitType.Self) {
			return contextPlayer || null;
		} else {
			return null;
		}
	}

	setPlayer(eventID: EventID, index: number, newPlayer: Player<any> | null) {
		const party = this.parties[Math.floor(index / MAX_PARTY_SIZE)];
		party.setPlayer(eventID, index % MAX_PARTY_SIZE, newPlayer);
	}

	getClassCount(playerClass: Class) {
		return this.getPlayers().filter(player => player != null && player.getClass() == playerClass).length;
	}

	getBuffs(): RaidBuffs {
		// Make a defensive copy
		return RaidBuffs.clone(this.raidState.buffs);
	}

	setBuffs(eventID: EventID, newBuffs: RaidBuffs) {
		if (RaidBuffs.equals(this.raidState.buffs, newBuffs)) return;

		// Make a defensive copy
		this.patchRaid(eventID, { buffs: RaidBuffs.clone(newBuffs) });
	}

	getDebuffs(): Debuffs {
		// Make a defensive copy
		return Debuffs.clone(this.raidState.debuffs);
	}

	setDebuffs(eventID: EventID, newDebuffs: Debuffs) {
		if (Debuffs.equals(this.raidState.debuffs, newDebuffs)) return;

		// Make a defensive copy
		this.patchRaid(eventID, { debuffs: Debuffs.clone(newDebuffs) });
	}

	getTanks(): Array<UnitReference> {
		// Make a defensive copy
		return this.raidState.tanks.map(tank => UnitReference.clone(tank));
	}

	setTanks(eventID: EventID, newTanks: Array<UnitReference>) {
		const tanks = this.raidState.tanks;
		if (tanks.length == newTanks.length && tanks.every((tank, i) => UnitReference.equals(tank, newTanks[i]))) return;

		// Make a defensive copy
		this.patchRaid(eventID, { tanks: newTanks.map(tank => UnitReference.clone(tank)) });
	}

	getTargetDummies(): number {
		return this.raidState.targetDummies;
	}

	setTargetDummies(eventID: EventID, newTargetDummies: number) {
		if (this.raidState.targetDummies == newTargetDummies) return;

		this.patchRaid(eventID, { targetDummies: newTargetDummies });
	}

	getNumActiveParties(): number {
		return this.raidState.numActiveParties;
	}
	setNumActiveParties(eventID: EventID, newNumActiveParties: number) {
		if (newNumActiveParties != this.raidState.numActiveParties && newNumActiveParties > 0) {
			this.patchRaid(eventID, { numActiveParties: newNumActiveParties });
		}
	}
	getActivePlayers(): Array<Player<any>> {
		if (this.activePlayers.length == 0) {
			const activeParties = this.getParties().filter((party, i) => i < this.getNumActiveParties());
			this.activePlayers = activeParties
				.map(party => party.getPlayers())
				.flat()
				.filter(player => player != null) as Array<Player<any>>;
		}
		return this.activePlayers;
	}

	toProto(forExport?: boolean, forSimming?: boolean): RaidProto {
		return RaidProto.create({
			parties: this.parties.map(party => party.toProto(forExport, forSimming)),
			buffs: this.getBuffs(),
			debuffs: this.getDebuffs(),
			tanks: this.getTanks(),
			targetDummies: this.getTargetDummies(),
			numActiveParties: this.getNumActiveParties(),
		});
	}

	fromProto(eventID: EventID, proto: RaidProto) {
		batch(() => {
			this.setBuffs(eventID, proto.buffs || RaidBuffs.create());
			this.setDebuffs(eventID, proto.debuffs || Debuffs.create());
			this.setTanks(eventID, proto.tanks);
			this.setTargetDummies(eventID, proto.targetDummies);
			this.setNumActiveParties(eventID, proto.numActiveParties || 5);

			for (let i = 0; i < MAX_NUM_PARTIES; i++) {
				if (proto.parties[i]) {
					this.parties[i].fromProto(eventID, proto.parties[i]);
				} else {
					this.parties[i].clear(eventID);
				}
			}
		});
	}

	clear(eventID: EventID) {
		batch(() => {
			for (let i = 0; i < MAX_NUM_PARTIES; i++) {
				this.parties[i].clear(eventID);
			}
		});
	}
}
