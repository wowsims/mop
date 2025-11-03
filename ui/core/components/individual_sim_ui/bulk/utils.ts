import { ItemSlot } from '../../../proto/common';
import { getEnumValues } from '../../../utils';

// Combines Fingers 1 and 2 and Trinket 1 and 2 into single groups
export enum BulkSimItemSlot {
	ItemSlotHead,
	ItemSlotNeck,
	ItemSlotShoulder,
	ItemSlotBack,
	ItemSlotChest,
	ItemSlotWrist,
	ItemSlotHands,
	ItemSlotWaist,
	ItemSlotLegs,
	ItemSlotFeet,
	ItemSlotFinger,
	ItemSlotTrinket,
	ItemSlotMainHand,
	ItemSlotOffHand,
	ItemSlotHandWeapon, // Weapon grouping slot for specs that can dual-wield
}

// Return all eligible bulk item slots.
// If the player can dual-wield, exclude main-hand/off-hand in favor of the grouped weapons slot
// Otherwise include main-hand/off-hand instead of the grouped weapons slot
export const getBulkItemSlots = (canDualWield: boolean) => {
	const allSlots = getEnumValues<BulkSimItemSlot>(BulkSimItemSlot);
	if (canDualWield) {
		return allSlots.filter(bulkSlot => ![BulkSimItemSlot.ItemSlotMainHand, BulkSimItemSlot.ItemSlotOffHand].includes(bulkSlot));
	} else {
		return allSlots.filter(bulkSlot => bulkSlot !== BulkSimItemSlot.ItemSlotHandWeapon);
	}
};

export const itemSlotToBulkSimItemSlot: Map<ItemSlot, BulkSimItemSlot> = new Map([
	[ItemSlot.ItemSlotHead, BulkSimItemSlot.ItemSlotHead],
	[ItemSlot.ItemSlotNeck, BulkSimItemSlot.ItemSlotNeck],
	[ItemSlot.ItemSlotShoulder, BulkSimItemSlot.ItemSlotShoulder],
	[ItemSlot.ItemSlotBack, BulkSimItemSlot.ItemSlotBack],
	[ItemSlot.ItemSlotChest, BulkSimItemSlot.ItemSlotChest],
	[ItemSlot.ItemSlotWrist, BulkSimItemSlot.ItemSlotWrist],
	[ItemSlot.ItemSlotHands, BulkSimItemSlot.ItemSlotHands],
	[ItemSlot.ItemSlotWaist, BulkSimItemSlot.ItemSlotWaist],
	[ItemSlot.ItemSlotLegs, BulkSimItemSlot.ItemSlotLegs],
	[ItemSlot.ItemSlotFeet, BulkSimItemSlot.ItemSlotFeet],
	[ItemSlot.ItemSlotFinger1, BulkSimItemSlot.ItemSlotFinger],
	[ItemSlot.ItemSlotFinger2, BulkSimItemSlot.ItemSlotFinger],
	[ItemSlot.ItemSlotTrinket1, BulkSimItemSlot.ItemSlotTrinket],
	[ItemSlot.ItemSlotTrinket2, BulkSimItemSlot.ItemSlotTrinket],
	[ItemSlot.ItemSlotMainHand, BulkSimItemSlot.ItemSlotMainHand],
	[ItemSlot.ItemSlotOffHand, BulkSimItemSlot.ItemSlotOffHand],
]);

export const bulkSimItemSlotToSingleItemSlot: Map<BulkSimItemSlot, ItemSlot> = new Map([
	[BulkSimItemSlot.ItemSlotHead, ItemSlot.ItemSlotHead,],
	[BulkSimItemSlot.ItemSlotNeck, ItemSlot.ItemSlotNeck],
	[BulkSimItemSlot.ItemSlotShoulder, ItemSlot.ItemSlotShoulder],
	[BulkSimItemSlot.ItemSlotBack, ItemSlot.ItemSlotBack],
	[BulkSimItemSlot.ItemSlotChest, ItemSlot.ItemSlotChest],
	[BulkSimItemSlot.ItemSlotWrist, ItemSlot.ItemSlotWrist],
	[BulkSimItemSlot.ItemSlotHands, ItemSlot.ItemSlotHands],
	[BulkSimItemSlot.ItemSlotWaist, ItemSlot.ItemSlotWaist],
	[BulkSimItemSlot.ItemSlotLegs, ItemSlot.ItemSlotLegs],
	[BulkSimItemSlot.ItemSlotFeet, ItemSlot.ItemSlotFeet],
	[BulkSimItemSlot.ItemSlotMainHand, ItemSlot.ItemSlotMainHand],
	[BulkSimItemSlot.ItemSlotOffHand, ItemSlot.ItemSlotOffHand],
]);

export const bulkSimItemSlotToItemSlotPairs: Map<BulkSimItemSlot, [ItemSlot, ItemSlot]> = new Map([
	[BulkSimItemSlot.ItemSlotFinger, [ItemSlot.ItemSlotFinger1, ItemSlot.ItemSlotFinger2]],
	[BulkSimItemSlot.ItemSlotTrinket, [ItemSlot.ItemSlotTrinket1, ItemSlot.ItemSlotTrinket2]],
	[BulkSimItemSlot.ItemSlotHandWeapon, [ItemSlot.ItemSlotMainHand, ItemSlot.ItemSlotOffHand]],
]);

export const getBulkItemSlotFromSlot = (slot: ItemSlot, canDualWield: boolean): BulkSimItemSlot => {
	if (canDualWield && [ItemSlot.ItemSlotMainHand, ItemSlot.ItemSlotOffHand].includes(slot)) {
		return BulkSimItemSlot.ItemSlotHandWeapon;
	}
	return itemSlotToBulkSimItemSlot.get(slot)!;
};

export const binomialCoefficient = (n: number, k: number): number => {
  if (Number.isNaN(n) || Number.isNaN(k)) return NaN;
  if (k < 0 || k > n) return 0;
  if (k === 0 || k === n) return 1;
  if (k === 1 || k === n - 1) return n;
  if (n - k < k) k = n - k;
  let res = n;
  for (let j = 2; j <= k; j++) res *= (n - j + 1) / j;
  return Math.round(res);
};

export function getAllPairs<T>(arr: T[]): [T, T][] {
  const pairs: [T, T][] = [];
  for (let i = 0; i < arr.length; i++) {
    for (let j = i + 1; j < arr.length; j++) {
      pairs.push([arr[i], arr[j]]);
    }
  }
  return pairs;
}
