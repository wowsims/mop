import { CURRENT_API_VERSION } from '../constants/other';
import { Player } from '../player';
import { PseudoStat, Stat } from '../proto/common';
import { SavedStatWeightSettings } from '../proto/ui';
import { UnitStat } from '../proto_utils/stats';
import { EventID } from '../state/batch';
import { subscribeGated } from './batch';
import { SimState, SimStore, StatWeightsSlice } from './sim_store';
// Stat-weight modal settings. Values live in the sim store
// (`statWeights[player.storeKey]`) with a version counter; persists itself to
// localStorage on every change.
export class StatWeightActionSettings {
	private readonly storageKey: string;
	readonly store: SimStore;
	readonly storeKey: number;

	constructor(player: Player<any>, storageKey: string) {
		this.storageKey = storageKey;
		this.store = player.sim.store;
		this.storeKey = player.storeKey;

		const seed: StatWeightsSlice = { excludedStats: [], excludedPseudoStats: [], version: 0 };
		this.store.setState(s => ({ statWeights: { ...s.statWeights, [this.storeKey]: seed } }));

		subscribeGated(
			this.store.subscribe,
			(s: SimState) => s.statWeights[this.storeKey]?.version,
			() => {
				const json = SavedStatWeightSettings.toJsonString(this.toProto());
				window.localStorage.setItem(this.storageKey, json);
			},
		);
	}

	private get slice(): StatWeightsSlice {
		return this.store.getState().statWeights[this.storeKey];
	}

	// Silent writes (the old setters assigned without emitting).
	private write(patch: Partial<StatWeightsSlice>) {
		this.store.setState(s => ({ statWeights: { ...s.statWeights, [this.storeKey]: { ...s.statWeights[this.storeKey], ...patch } } }));
	}

	private bump(eventID: EventID) {
		this.store.setState(s => {
				const sw = s.statWeights[this.storeKey];
				return { statWeights: { ...s.statWeights, [this.storeKey]: { ...sw, version: sw.version + 1 } } };
			});
	}

	set excludedStats(value: Stat[]) {
		this.write({ excludedStats: value });
	}
	get excludedStats(): Stat[] {
		return this.slice.excludedStats.slice();
	}

	set excludedPseudoStats(value: PseudoStat[]) {
		this.write({ excludedPseudoStats: value });
	}
	get excludedPseudoStats(): PseudoStat[] {
		return this.slice.excludedPseudoStats.slice();
	}

	static updateProtoVersion(_: SavedStatWeightSettings) {
		// No-op, as there are no proto version migrations currently
	}

	applyDefaults(eventID: EventID) {
		this.excludedStats = [];
		this.excludedPseudoStats = [];
		this.bump(eventID);
	}

	load(eventID: EventID) {
		const storageValue = window.localStorage.getItem(this.storageKey);
		if (storageValue) {
			const settingsProto = SavedStatWeightSettings.fromJsonString(storageValue, { ignoreUnknownFields: true });
			StatWeightActionSettings.updateProtoVersion(settingsProto);

			const { excludedStats, excludedPseudoStats } = settingsProto;
			this.excludedStats = excludedStats || [];
			this.excludedPseudoStats = excludedPseudoStats || [];
			this.bump(eventID);
		}
	}

	toProto(): SavedStatWeightSettings {
		return SavedStatWeightSettings.create({
			apiVersion: CURRENT_API_VERSION,
			excludedStats: this.excludedStats,
			excludedPseudoStats: this.excludedPseudoStats,
		});
	}

	/**
	 * Check if a stat should be excluded from weight calculation.
	 * @param stat
	 * @returns true if stat should be excluded.
	 */
	isStatExcludedFromCalc(stat: Stat): boolean {
		return !!this.excludedStats.includes(stat);
	}

	/**
	 * Check if a pseudostat should be excluded from weight calculation.
	 * @param pseudoStat
	 * @returns true if pseudostat should be excluded.
	 */
	isPseudoStatExcludedFromCalc(pseudoStat: PseudoStat): boolean {
		return !!this.excludedPseudoStats.includes(pseudoStat);
	}

	/**
	 * Check if a unitstat should be excluded from weight calculation.
	 * @param unitstat
	 * @returns true if unitstat should be excluded.
	 */
	isUnitStatExcludedFromCalc(unitstat: UnitStat): boolean {
		return unitstat.isStat() ? this.isStatExcludedFromCalc(unitstat.getStat()) : this.isPseudoStatExcludedFromCalc(unitstat.getPseudoStat());
	}

	/**
	 * Set whether a stat should be excluded from calculation.
	 * @param stat
	 * @param exclude
	 */
	setStatExcluded(eventID: EventID, stat: UnitStat, exclude: boolean) {
		const updateStatEntry = <T extends Stat | PseudoStat>(s: T, target: T[]) => {
			const currentIdx = target.indexOf(s);
			if (exclude) {
				if (currentIdx === -1) target.push(s);
			} else if (currentIdx !== -1) {
				target.splice(currentIdx, 1);
			}
			return target;
		};
		if (stat.isStat()) {
			this.excludedStats = updateStatEntry(stat.getStat(), this.excludedStats);
		} else {
			this.excludedPseudoStats = updateStatEntry(stat.getPseudoStat(), this.excludedPseudoStats);
		}
		this.bump(eventID);
	}
}
