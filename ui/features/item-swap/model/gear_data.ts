import type { Player } from '@sim/player';
import type { EquippedItem } from '@sim/proto_utils/equipped_item';
import { subscribePlayerField } from '@sim/state/subscriptions';
import type { GearData } from '@features/gear/types';
import type { ItemSlot } from '@generated/proto/common';

export const createItemSwapGearData = (player: Player<any>, slot: ItemSlot): GearData => ({
	equipItem: (equippedItem: EquippedItem | null) => player.itemSwapSettings.equipItem(slot, equippedItem),
	getEquippedItem: () => player.itemSwapSettings.getItem(slot),
	subscribe: subscribePlayerField(player, 'itemSwap'),
});
