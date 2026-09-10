import { BulkRequiredSetBonus } from '@generated/proto/api';
import type { Player } from '@sim/player/player';
import { bulkState } from '@sim/settings/bulk_settings';
import type { BulkSlice } from '@sim/state/sim_store';

import {
	type BulkSetBonusOption,
	type BulkSlotOptions,
	type CanSatisfySetBonus,
	getAvailableBulkSetBonuses,
	hasMatchingRequiredSetBonusCombination,
} from './set_bonuses';

// The batch's per-slot choices, equipped pieces included: the pickers are where they live, and
// the set-bonus model takes them as data rather than reaching into the DOM for them.
export const slotOptionsOf = (pickerGroups: BulkSlice['pickerGroups']): BulkSlotOptions =>
	new Map(Array.from(pickerGroups).map(([bulkSlot, entries]) => [bulkSlot, entries.map(entry => entry.item)]));

// A selector has to hand back the same array for the same state, and the groups map is replaced on every write.
const setBonusesByGroups = new WeakMap<BulkSlice['pickerGroups'], BulkSetBonusOption[]>();

export const canRunBatch = (slice: BulkSlice, combinationsLimit: number): boolean =>
	!slice.combinationsPending && !slice.isRunning && slice.combinations > 1 && slice.combinations <= combinationsLimit;

// Every set-bonus checkbox asks whether its own combination is still reachable, so the per-slot DP
// would run once per checkbox on every change. One factory per batch state answers them all from
// one cache; the gear is read on demand, because a run swaps the player's own gear as it goes.
export const setBonusFeasibility = (
	player: Player<any>,
	pickerGroups: BulkSlice['pickerGroups'],
	requiredSetBonuses: BulkSlice['requiredSetBonuses'],
): CanSatisfySetBonus => {
	const answers = new Map<string, boolean>();
	let slotOptions: BulkSlotOptions | null = null;

	return (setId, pieces) => {
		const key = `${setId}:${pieces}`;
		const answer = answers.get(key);
		if (answer !== undefined) return answer;

		slotOptions ??= slotOptionsOf(pickerGroups);
		const candidates = Array.from(requiredSetBonuses.values()).filter(requiredSetBonus => requiredSetBonus.setId !== setId);
		candidates.push(BulkRequiredSetBonus.create({ setId, pieces }));
		const result = hasMatchingRequiredSetBonusCombination(candidates, bulkState(player).runGear ?? player.getGear(), slotOptions);
		answers.set(key, result);
		return result;
	};
};

export const availableSetBonuses = ({ pickerGroups }: BulkSlice): BulkSetBonusOption[] => {
	let setBonuses = setBonusesByGroups.get(pickerGroups);
	if (!setBonuses) {
		setBonuses = getAvailableBulkSetBonuses(slotOptionsOf(pickerGroups));
		setBonusesByGroups.set(pickerGroups, setBonuses);
	}
	return setBonuses;
};
