import type { BulkSlice } from '@sim/state/sim_store';

import { type BulkSetBonusOption, type BulkSlotOptions, getAvailableBulkSetBonuses } from './set_bonuses';

// The batch's per-slot choices, equipped pieces included: the pickers are where they live, and
// the set-bonus model takes them as data rather than reaching into the DOM for them.
export const slotOptionsOf = (pickerGroups: BulkSlice['pickerGroups']): BulkSlotOptions =>
	new Map(Array.from(pickerGroups).map(([bulkSlot, entries]) => [bulkSlot, entries.map(entry => entry.item)]));

// A selector has to hand back the same array for the same state, and the groups map is replaced on every write.
const setBonusesByGroups = new WeakMap<BulkSlice['pickerGroups'], BulkSetBonusOption[]>();

export const availableSetBonuses = ({ pickerGroups }: BulkSlice): BulkSetBonusOption[] => {
	let setBonuses = setBonusesByGroups.get(pickerGroups);
	if (!setBonuses) {
		setBonuses = getAvailableBulkSetBonuses(slotOptionsOf(pickerGroups));
		setBonusesByGroups.set(pickerGroups, setBonuses);
	}
	return setBonuses;
};
