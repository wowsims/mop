import type { Player } from '@domain/player';
import { batch } from '@domain/state/batch';
import type { ItemSlot, Spec } from '@generated/proto/common';

/**
 * Exchanges the equipped item and the swap item in each of `itemSlots`, in one batch so the two
 * writes land as a single notification.
 *
 * `canDualWield2H()` is passed through because `withEquippedItem` uses it to decide whether putting
 * a two-hander in one hand has to clear the other — the swap can move a weapon into either side.
 */
export const swapWithGear = <SpecType extends Spec>(player: Player<SpecType>, itemSlots: ReadonlyArray<ItemSlot>): void => {
	let newGear = player.getGear();
	let newSwapGear = player.itemSwapSettings.getGear();

	for (const slot of itemSlots) {
		const gearItem = player.getGear().getEquippedItem(slot);
		const swapItem = player.itemSwapSettings.getGear().getEquippedItem(slot);
		newGear = newGear.withEquippedItem(slot, swapItem, player.canDualWield2H());
		newSwapGear = newSwapGear.withEquippedItem(slot, gearItem, player.canDualWield2H());
	}

	batch(() => {
		player.setGear(newGear);
		player.itemSwapSettings.setGear(newSwapGear);
	});
};
