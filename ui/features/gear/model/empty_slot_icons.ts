import { ItemSlot } from '@generated/proto/common';

const emptySlotIcons: Record<ItemSlot, string> = {
	[ItemSlot.ItemSlotHead]: '/mop/assets/item_slots/head.jpg',
	[ItemSlot.ItemSlotNeck]: '/mop/assets/item_slots/neck.jpg',
	[ItemSlot.ItemSlotShoulder]: '/mop/assets/item_slots/shoulders.jpg',
	[ItemSlot.ItemSlotBack]: '/mop/assets/item_slots/chest.jpg',
	[ItemSlot.ItemSlotChest]: '/mop/assets/item_slots/chest.jpg',
	[ItemSlot.ItemSlotWrist]: '/mop/assets/item_slots/wrists.jpg',
	[ItemSlot.ItemSlotHands]: '/mop/assets/item_slots/hands.jpg',
	[ItemSlot.ItemSlotWaist]: '/mop/assets/item_slots/waist.jpg',
	[ItemSlot.ItemSlotLegs]: '/mop/assets/item_slots/legs.jpg',
	[ItemSlot.ItemSlotFeet]: '/mop/assets/item_slots/feet.jpg',
	[ItemSlot.ItemSlotFinger1]: '/mop/assets/item_slots/finger.jpg',
	[ItemSlot.ItemSlotFinger2]: '/mop/assets/item_slots/finger.jpg',
	[ItemSlot.ItemSlotTrinket1]: '/mop/assets/item_slots/trinket.jpg',
	[ItemSlot.ItemSlotTrinket2]: '/mop/assets/item_slots/trinket.jpg',
	[ItemSlot.ItemSlotMainHand]: '/mop/assets/item_slots/mainhand.jpg',
	[ItemSlot.ItemSlotOffHand]: '/mop/assets/item_slots/offhand.jpg',
};

export const getEmptySlotIconUrl = (slot: ItemSlot): string => emptySlotIcons[slot];
