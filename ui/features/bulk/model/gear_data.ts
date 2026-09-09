import { Emitter } from '@sim/state/events';
import type { EquippedItem } from '@sim/proto/equipped_item';
import type { ItemSpec } from '@generated/proto/common';
import type { GearData } from '@features/gear/types';

import type { BulkPickerGroup } from './picker_groups';

/**
 * The selector modal's seam for a batch entry: equipping writes back into the batch instead of onto
 * the player, and the item is read out of the group each time, so a modal left open on an entry
 * that has just been replaced shows the replacement.
 */
export const createBulkGearData = (tab: { updateItem: (index: number, spec: ItemSpec) => void }, group: BulkPickerGroup, index: number): GearData => {
	const changeEvent = new Emitter<void>();
	return {
		equipItem: (newItem: EquippedItem | null) => {
			if (!newItem) return;
			tab.updateItem(index, newItem.asSpec());
			changeEvent.emit();
		},
		getEquippedItem: () => group.entries.find(entry => entry.index === index)?.item ?? null,
		subscribe: onChange => changeEvent.on(onChange),
	};
};
