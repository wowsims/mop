import { Party as PartyProto, Player as PlayerProto } from '@generated/proto/api';
import { Class, PartyBuffs } from '@generated/proto/common';

import { Player } from './player';
import { getPlayerSpecFromPlayer } from './proto_utils/utils';
import { Raid } from './raid';
import { Sim } from './sim';
import { batch, EventID } from './state/batch';
export const MAX_PARTY_SIZE = 5;

// Manages all the settings for a single Party.
export class Party {
	readonly sim: Sim;
	readonly raid: Raid;
	// This party's fixed index within the raid's parties array.
	private readonly index: number;

	// Should always hold exactly MAX_PARTY_SIZE elements.
	private players: Array<Player<any> | null>;

	constructor(raid: Raid, sim: Sim, index: number) {
		this.sim = sim;
		this.raid = raid;
		this.index = index;
		this.players = [...Array(MAX_PARTY_SIZE).keys()].map(_i => null);
	}

	// Writes this party's slot → storeKey row (replace-on-write).
	private writeComposition(eventID: EventID) {
		const row = this.players.map(p => (p ? p.storeKey : null));
		this.sim.store.setState(s => ({
			raid: { ...s.raid, composition: s.raid.composition.map((r, i) => (i == this.index ? row : r)) },
		}));
	}

	size(): number {
		return this.players.filter(player => player != null).length;
	}

	isEmpty(): boolean {
		return this.size() == 0;
	}

	clear(eventID: EventID) {
		this.setBuffs(eventID, PartyBuffs.create());
		for (let i = 0; i < MAX_PARTY_SIZE; i++) {
			this.setPlayer(eventID, i, null);
		}
	}

	// Returns this party's index within the raid [0-4].
	getIndex(): number {
		return this.index;
	}

	getPlayers(): Array<Player<any> | null> {
		// Make defensive copy.
		return this.players.slice();
	}

	getPlayer(playerIndex: number): Player<any> | null {
		return this.players[playerIndex];
	}

	setPlayer(eventID: EventID, playerIndex: number, newPlayer: Player<any> | null) {
		if (playerIndex < 0 || playerIndex >= MAX_PARTY_SIZE) {
			throw new Error('Invalid player index: ' + playerIndex);
		}

		if (newPlayer == this.players[playerIndex]) {
			return;
		}

		const displaced = newPlayer != null ? this.players[playerIndex] : null;
		batch(() => {
			const oldPlayer = this.players[playerIndex];
			if (oldPlayer != null) {
				oldPlayer.setParty(null);
			}
			if (newPlayer != null) {
				const newPlayerOldParty = newPlayer.getParty();
				if (newPlayerOldParty) {
					newPlayerOldParty.setPlayer(eventID, newPlayer.getPartyIndex(), null);
				}
				this.players[playerIndex] = newPlayer;
				newPlayer.setParty(this);
			} else {
				this.players[playerIndex] = null;
			}

			this.writeComposition(eventID);
		});

		// Discard detection: a player displaced by a replacement is disposed
		// unless it gets re-placed somewhere (a move/swap) before the current
		// task finishes. Removals (newPlayer == null) never dispose — the move
		// path removes from the old slot first and re-places immediately.
		if (displaced) {
			queueMicrotask(() => {
				if (displaced.getParty() == null && !displaced.isDisposed()) {
					displaced.dispose();
				}
			});
		}
	}

	private get storedBuffs(): PartyBuffs {
		return this.sim.store.getState().raid.partyBuffs[this.index];
	}

	getBuffs(): PartyBuffs {
		// Make a defensive copy
		return PartyBuffs.clone(this.storedBuffs);
	}

	setBuffs(eventID: EventID, newBuffs: PartyBuffs) {
		if (PartyBuffs.equals(this.storedBuffs, newBuffs)) return;

		// Make a defensive copy
		const clone = PartyBuffs.clone(newBuffs);
		this.sim.store.setState(s => ({ raid: { ...s.raid, partyBuffs: s.raid.partyBuffs.map((b, i) => (i == this.index ? clone : b)) } }));
	}

	toProto(forExport?: boolean, forSimming?: boolean): PartyProto {
		return PartyProto.create({
			players: this.players.map(player => (player == null ? PlayerProto.create() : player.toProto(forExport, forSimming))),
			buffs: this.storedBuffs,
		});
	}

	fromProto(eventID: EventID, proto: PartyProto) {
		batch(() => {
			this.setBuffs(eventID, proto.buffs || PartyBuffs.create());

			for (let i = 0; i < MAX_PARTY_SIZE; i++) {
				if (!proto.players[i] || proto.players[i].class == Class.ClassUnknown) {
					this.setPlayer(eventID, i, null);
					continue;
				}

				const playerProto = proto.players[i];
				const spec = getPlayerSpecFromPlayer(playerProto);
				const currentPlayer = this.players[i];

				// Reuse the current player if possible, so that event handlers are preserved.
				if (currentPlayer && spec.specID == currentPlayer.getSpec()) {
					currentPlayer.fromProto(eventID, playerProto);
				} else {
					const newPlayer = new Player(spec, this.sim);
					newPlayer.fromProto(eventID, playerProto);
					this.setPlayer(eventID, i, newPlayer);
					// The replaced instance is referenced nowhere else (pickers
					// re-sync from the composition write above).
					currentPlayer?.dispose();
				}
			}
		});
	}
}
