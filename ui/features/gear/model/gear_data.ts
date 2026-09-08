import type { Player } from '@sim/player/player';
import type { EquippedItem } from '@sim/proto/equipped_item';
import { subscribePlayerField } from '@sim/state/subscriptions';
import { ItemSlot } from '@generated/proto/common';

import type { GearData } from '../types';

export const LEFT_ITEM_SLOTS: ReadonlyArray<ItemSlot> = [
	ItemSlot.ItemSlotHead,
	ItemSlot.ItemSlotNeck,
	ItemSlot.ItemSlotShoulder,
	ItemSlot.ItemSlotBack,
	ItemSlot.ItemSlotChest,
	ItemSlot.ItemSlotWrist,
	ItemSlot.ItemSlotMainHand,
	ItemSlot.ItemSlotOffHand,
];

export const RIGHT_ITEM_SLOTS: ReadonlyArray<ItemSlot> = [
	ItemSlot.ItemSlotHands,
	ItemSlot.ItemSlotWaist,
	ItemSlot.ItemSlotLegs,
	ItemSlot.ItemSlotFeet,
	ItemSlot.ItemSlotFinger1,
	ItemSlot.ItemSlotFinger2,
	ItemSlot.ItemSlotTrinket1,
	ItemSlot.ItemSlotTrinket2,
];

export const ALL_ITEM_SLOTS: ReadonlyArray<ItemSlot> = [...LEFT_ITEM_SLOTS, ...RIGHT_ITEM_SLOTS].sort((a, b) => a - b);

export const createGearData = (player: Player<any>, slot: ItemSlot): GearData => ({
	equipItem: (equippedItem: EquippedItem | null) => player.equipItem(slot, equippedItem),
	getEquippedItem: () => player.getEquippedItem(slot)?.withChallengeMode(player.getChallengeModeEnabled()).withDynamicStats() || null,
	subscribe: subscribePlayerField(player, 'gear'),
});
