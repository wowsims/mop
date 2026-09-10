import { ItemSlot, ItemSpec } from '@generated/proto/common';
import i18n from '@i18n/config';
import type { BulkPickerEntry } from '@sim/bulk/types';
import { BulkSimItemSlot, getBulkItemSlotFromSlot, getBulkPlayerCanDualWield } from '@sim/bulk/utils';
import { isSpecDualWield2HCapable } from '@sim/player/classes/capabilities';
import type { Player } from '@sim/player/player';
import type { EquippedItem } from '@sim/proto/equipped_item';
import { canEquipItem, getEligibleItemSlots, isSecondaryItemSlot } from '@sim/proto/items';
import { bulkState, patchBulkState } from '@sim/settings/bulk_settings';
import { getEnumValues } from '@sim/utils/collections';
import { toastManager } from '@ui-kit/Toast';

import { addPickerEntry, pickerEntryAt, removePickerEntry, updatePickerEntry } from './picker_groups';

type PickerGroups = Map<BulkSimItemSlot, readonly BulkPickerEntry[]>;

// Return whether or not the slot is considered secondary and the item should be grouped
// This includes items in the Finger2 or Trinket2 slots, or OffHand for dual-wield specs
const isSecondaryBulkSlot = (slot: ItemSlot, playerCanDualWield: boolean) =>
	isSecondaryItemSlot(slot) || (playerCanDualWield && slot === ItemSlot.ItemSlotOffHand);

const lookupItem = (player: Player<any>, item: ItemSpec): EquippedItem | null =>
	player.sim.db.lookupItemSpec(item)?.withChallengeMode(player.getChallengeModeEnabled()).withDynamicStats() ?? null;

const addToGroup = (groups: PickerGroups, bulkSlot: BulkSimItemSlot, idx: number, item: EquippedItem, silent: boolean): boolean => {
	const next = addPickerEntry(bulkSlot, groups.get(bulkSlot)!, idx, item);
	if (next === 'duplicate') {
		if (!silent) toastManager.add({ delay: 1000, variant: 'error', body: i18n.t('bulk_tab.search.item_unique', { itemName: item._item.name }) });
		return false;
	}
	groups.set(bulkSlot, next);
	if (!silent) toastManager.add({ delay: 1000, variant: 'success', body: i18n.t('bulk_tab.search.item_added', { itemName: item._item.name }) });
	return true;
};

// The groups a batch offers: one per bulk slot the player can actually fill, so a dual-wield spec
// pools its weapons into one group and everyone else keeps main hand and off hand apart.
export const seedBulkPickerGroups = (player: Player<any>) => {
	const playerCanDualWield = getBulkPlayerCanDualWield(player);
	const bulkSlots = getEnumValues<BulkSimItemSlot>(BulkSimItemSlot).filter(
		bulkSlot =>
			!(playerCanDualWield && [BulkSimItemSlot.ItemSlotMainHand, BulkSimItemSlot.ItemSlotOffHand].includes(bulkSlot)) &&
			!(!playerCanDualWield && bulkSlot === BulkSimItemSlot.ItemSlotHandWeapon),
	);
	patchBulkState(player, { pickerGroups: new Map<BulkSimItemSlot, readonly BulkPickerEntry[]>(bulkSlots.map(bulkSlot => [bulkSlot, []])) });
};

// Add items to their eligible bulk sim item slot(s). Mainly used for importing and search
export const addBulkItems = (player: Player<any>, items: ItemSpec[], silent = false) => {
	const playerCanDualWield = getBulkPlayerCanDualWield(player);
	const playerCanDualWield2H = isSpecDualWield2HCapable(player.getSpec());
	const batch = bulkState(player).items.slice();
	const groups = new Map(bulkState(player).pickerGroups);
	items.forEach(item => {
		const equippedItem = lookupItem(player, item);
		if (equippedItem) {
			getEligibleItemSlots(equippedItem.item, playerCanDualWield2H).forEach(slot => {
				// Avoid duplicating rings/trinkets/weapons
				if (isSecondaryBulkSlot(slot, playerCanDualWield) || !canEquipItem(equippedItem.item, player.getPlayerSpec(), slot)) return;

				const bulkSlot = getBulkItemSlotFromSlot(slot, playerCanDualWield);
				if (addToGroup(groups, bulkSlot, batch.length, equippedItem, silent)) {
					batch.push(item);
				}
			});
		}
	});

	patchBulkState(player, { items: batch, pickerGroups: groups }, ['items']);
};

export const addBulkItem = (player: Player<any>, item: ItemSpec) => addBulkItems(player, [item]);

// Add an item to a particular bulk sim item slot
export const addBulkItemToSlot = (player: Player<any>, item: ItemSpec, bulkSlot: BulkSimItemSlot) => {
	const equippedItem = lookupItem(player, item);
	if (equippedItem) {
		const eligibleItemSlots = getEligibleItemSlots(equippedItem.item, isSpecDualWield2HCapable(player.getSpec()));
		if (!canEquipItem(equippedItem.item, player.getPlayerSpec(), eligibleItemSlots[0])) return;

		const groups = new Map(bulkState(player).pickerGroups);
		const added = addToGroup(groups, bulkSlot, bulkState(player).items.length, equippedItem, false);
		patchBulkState(player, added ? { items: [...bulkState(player).items, item], pickerGroups: groups } : {}, ['items']);
	}
};

export const updateBulkItem = (player: Player<any>, idx: number, newItem: ItemSpec) => {
	const equippedItem = lookupItem(player, newItem);
	if (!equippedItem) {
		patchBulkState(player, {}, ['items']);
		return;
	}

	const playerCanDualWield = getBulkPlayerCanDualWield(player);
	const batch = bulkState(player).items.slice();
	batch[idx] = newItem;
	const groups = new Map(bulkState(player).pickerGroups);
	getEligibleItemSlots(equippedItem.item, isSpecDualWield2HCapable(player.getSpec())).forEach(slot => {
		// Avoid duplicating rings/trinkets/weapons
		if (isSecondaryBulkSlot(slot, playerCanDualWield) || !canEquipItem(equippedItem.item, player.getPlayerSpec(), slot)) return;

		const bulkSlot = getBulkItemSlotFromSlot(slot, playerCanDualWield);
		const next = updatePickerEntry(groups.get(bulkSlot)!, idx, equippedItem);
		if (next) {
			groups.set(bulkSlot, next);
		} else {
			toastManager.add({ variant: 'error', body: i18n.t('bulk_tab.picker.failed_update') });
		}
	});

	patchBulkState(player, { items: batch, pickerGroups: groups }, ['items']);
};

export const removeBulkItemByIndex = (player: Player<any>, idx: number, silent = false) => {
	const items = bulkState(player).items;
	if (idx < 0 || items.length < idx || !items[idx]) {
		if (!silent) {
			toastManager.add({
				variant: 'error',
				body: i18n.t('bulk_tab.notifications.failed_to_remove_item'),
			});
		}
		return;
	}

	const equippedItem = player.sim.db.lookupItemSpec(items[idx]!);
	if (equippedItem) {
		const playerCanDualWield = getBulkPlayerCanDualWield(player);
		const batch = items.slice();
		batch[idx] = null;
		const groups = new Map(bulkState(player).pickerGroups);

		// Try to find the matching item within its eligible groups
		getEligibleItemSlots(equippedItem.item, isSpecDualWield2HCapable(player.getSpec())).forEach(slot => {
			if (!canEquipItem(equippedItem.item, player.getPlayerSpec(), slot)) return;
			const bulkSlot = getBulkItemSlotFromSlot(slot, playerCanDualWield);
			const entries = groups.get(bulkSlot)!;

			const removed = pickerEntryAt(entries, idx);
			groups.set(bulkSlot, removePickerEntry(entries, idx));
			if (removed && !silent) {
				toastManager.add({ delay: 1000, variant: 'success', body: i18n.t('bulk_tab.search.item_removed', { itemName: removed.item._item.name }) });
			}
		});
		patchBulkState(player, { items: batch, pickerGroups: groups }, ['items']);
	}
};

export const removeBulkItem = (player: Player<any>, item: ItemSpec) => {
	const idx = bulkState(player).items.findIndex(spec => !!spec && ItemSpec.equals(spec, item));
	if (idx >= 0) removeBulkItemByIndex(player, idx);
};

export const clearBulkItems = (player: Player<any>) => {
	for (let idx = 0; idx < bulkState(player).items.length; idx++) {
		removeBulkItemByIndex(player, idx, true);
	}
	patchBulkState(player, { items: [] }, ['items']);
};

export const hasBulkItem = (player: Player<any>, item: ItemSpec): boolean => bulkState(player).items.some(spec => !!spec && ItemSpec.equals(spec, item));

export const loadEquippedBulkItems = (player: Player<any>) => {
	if (bulkState(player).isRunning) {
		return;
	}

	const playerCanDualWield = getBulkPlayerCanDualWield(player);
	const playerCanDualWield2H = isSpecDualWield2HCapable(player.getSpec());
	const groups = new Map(bulkState(player).pickerGroups);
	// Clear all previously equipped items from the pickers
	for (const [bulkSlot, entries] of groups) {
		groups.set(bulkSlot, removePickerEntry(removePickerEntry(entries, -1), -2));
	}

	const equippedIds = new Set(
		player
			.getEquippedItems()
			.filter(Boolean)
			.map(item => item!.id),
	);

	// Sync user-added pickers with currently equipped state:
	// - Hide pickers for items that are now equipped (the dedicated equipped slot covers them).
	// - Restore pickers for items that are no longer equipped but still in the user's list.
	bulkState(player).items.forEach((itemSpec, idx) => {
		if (!itemSpec) return;

		const equippedItem = lookupItem(player, itemSpec);
		if (!equippedItem) return;

		getEligibleItemSlots(equippedItem.item, playerCanDualWield2H).forEach(slot => {
			if (isSecondaryBulkSlot(slot, playerCanDualWield) || !canEquipItem(equippedItem.item, player.getPlayerSpec(), slot)) return;

			const bulkSlot = getBulkItemSlotFromSlot(slot, playerCanDualWield);
			const entries = groups.get(bulkSlot);
			if (!entries) return;

			if (equippedIds.has(itemSpec.id)) {
				groups.set(bulkSlot, removePickerEntry(entries, idx));
			} else if (!pickerEntryAt(entries, idx)) {
				const next = addPickerEntry(bulkSlot, entries, idx, equippedItem);
				if (next !== 'duplicate') groups.set(bulkSlot, next);
			}
		});
	});

	player.getEquippedItems().forEach((equippedItem, slot) => {
		const bulkSlot = getBulkItemSlotFromSlot(slot, playerCanDualWield);
		const entries = groups.get(bulkSlot);
		if (!entries) return;
		const idx = isSecondaryBulkSlot(slot, playerCanDualWield) ? -2 : -1;
		if (equippedItem) {
			const next = addPickerEntry(bulkSlot, entries, idx, equippedItem);
			if (next !== 'duplicate') groups.set(bulkSlot, next);
		}
	});

	patchBulkState(player, { pickerGroups: groups }, ['items']);
};
