import { Emitter } from '@sim/state/events';
import type { EquippedItem } from '@sim/proto/equipped_item';
import type { GearData } from '@features/gear/types';
import type { BulkSimItemSlot } from '@sim/bulk/constants_auto_gen';
import type { Player } from '@sim/player/player';
import { bulkState } from '@sim/settings/bulk_settings';

import { updateBulkItem } from './items';
import { pickerEntryAt } from './picker_groups';

/**
 * The selector modal's seam for a batch entry: equipping writes back into the batch instead of onto
 * the player, and the item is read out of the group each time, so a modal left open on an entry
 * that has just been replaced shows the replacement.
 */
export const createBulkGearData = (player: Player<any>, bulkSlot: BulkSimItemSlot, index: number): GearData => {
	const changeEvent = new Emitter<void>();
	return {
		equipItem: (newItem: EquippedItem | null) => {
			if (!newItem) return;
			updateBulkItem(player, index, newItem.asSpec());
			changeEvent.emit();
		},
		getEquippedItem: () => pickerEntryAt(bulkState(player).pickerGroups.get(bulkSlot) ?? [], index)?.item ?? null,
		subscribe: onChange => changeEvent.on(onChange),
	};
};
