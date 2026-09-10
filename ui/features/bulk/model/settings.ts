import { BulkSettings } from '@generated/proto/api';
import { ItemSlot, ItemSpec, WeaponType } from '@generated/proto/common';
import { BULK_SIM_ITEM_SLOT_TO_ITEM_SLOT_PAIRS, BulkSimItemSlot, getBulkFreezeWeaponTypes } from '@sim/bulk/utils';
import type { Player } from '@sim/player/player';
import type { EquippedItem } from '@sim/proto/equipped_item';
import { bulkState, patchBulkState } from '@sim/settings/bulk_settings';

import { frozenItemSlot } from './picker_groups';
import { availableSetBonuses, setBonusFeasibility } from './selectors';
import { type BulkSetBonusOption, nextRequiredSetBonuses, pruneRequiredSetBonuses } from './set_bonuses';

export type BulkWeaponSlot = ItemSlot.ItemSlotMainHand | ItemSlot.ItemSlotOffHand;
export type BulkFrozenSlot = BulkSimItemSlot.ItemSlotFinger | BulkSimItemSlot.ItemSlotTrinket;

export const bulkFrozenItemSlot = (player: Player<any>, bulkSlot: BulkFrozenSlot): ItemSlot | undefined => {
	const slots = BULK_SIM_ITEM_SLOT_TO_ITEM_SLOT_PAIRS.get(bulkSlot);
	return frozenItemSlot(player.getGear(), slots, bulkState(player).frozenItems.get(bulkSlot)) ?? undefined;
};

export const createBulkSettingsProto = (player: Player<any>): BulkSettings => {
	const current = bulkState(player);
	return BulkSettings.create({
		items: current.items.flatMap(spec => (spec ? [ItemSpec.clone(spec)] : [])),
		inheritUpgrades: current.inheritUpgrades,
		useLegacyBulkSim: current.useLegacyBulkSim,
		iterationsPerCombo: player.sim.getIterations(),
		freezeRingSlot: bulkFrozenItemSlot(player, BulkSimItemSlot.ItemSlotFinger),
		freezeTrinketSlot: bulkFrozenItemSlot(player, BulkSimItemSlot.ItemSlotTrinket),
		freezeWeaponSlot: current.frozenWeaponSlot,
		freezeMainhandWeaponSlots: current.weaponTypeFilters.get(ItemSlot.ItemSlotMainHand)?.slice(),
		freezeOffhandWeaponSlots: current.weaponTypeFilters.get(ItemSlot.ItemSlotOffHand)?.slice(),
		requiredSetBonuses: pruneRequiredSetBonuses(current.requiredSetBonuses, availableSetBonuses(current)),
	});
};

export const sanitizeBulkWeaponTypeFilter = (player: Player<any>, slot: BulkWeaponSlot, weaponTypes: WeaponType[]): WeaponType[] => {
	const selectableWeaponTypes = getBulkFreezeWeaponTypes(player, slot);
	return weaponTypes.filter(weaponType => selectableWeaponTypes.includes(weaponType));
};

export const setBulkInheritUpgrades = (player: Player<any>, newValue: boolean) => patchBulkState(player, { inheritUpgrades: newValue }, ['settings']);

export const setBulkUseLegacyBulkSim = (player: Player<any>, newValue: boolean) => patchBulkState(player, { useLegacyBulkSim: newValue }, ['settings']);

export const setBulkFrozenItem = (player: Player<any>, bulkSlot: BulkFrozenSlot, item: EquippedItem | null) => {
	const frozenItems = bulkState(player).frozenItems;
	if (item === frozenItems.get(bulkSlot)) {
		return;
	}

	patchBulkState(player, { frozenItems: new Map(frozenItems).set(bulkSlot, item) }, ['settings']);
};

export const setBulkWeaponTypeFilter = (player: Player<any>, slot: BulkWeaponSlot, newFilter: WeaponType[], shouldEmit = true): boolean => {
	const weaponTypeFilters = bulkState(player).weaponTypeFilters;
	const currentFilter = weaponTypeFilters.get(slot)!;
	const hasChanged = currentFilter.length !== newFilter.length || currentFilter.some((weaponType, idx) => weaponType !== newFilter[idx]);

	if (!hasChanged) {
		return false;
	}

	patchBulkState(player, { weaponTypeFilters: new Map(weaponTypeFilters).set(slot, newFilter) }, shouldEmit ? ['settings'] : []);
	return true;
};

export const setBulkFrozenWeaponSlot = (player: Player<any>, itemSlot: number | null): boolean => {
	const newSlot = [ItemSlot.ItemSlotMainHand, ItemSlot.ItemSlotOffHand].includes(itemSlot ?? -1) ? (itemSlot as BulkWeaponSlot) : undefined;
	const filtersChanged = newSlot !== undefined && setBulkWeaponTypeFilter(player, newSlot, [], false);

	if (newSlot === bulkState(player).frozenWeaponSlot && !filtersChanged) {
		return false;
	}

	patchBulkState(player, { frozenWeaponSlot: newSlot }, ['settings']);
	return true;
};

export const setBulkRequiredSetBonus = (player: Player<any>, setBonus: BulkSetBonusOption, pieces: number) => {
	const { pickerGroups, requiredSetBonuses } = bulkState(player);
	const next = nextRequiredSetBonuses(requiredSetBonuses, setBonus, pieces, setBonusFeasibility(player, pickerGroups, requiredSetBonuses));
	if (!next) return;

	patchBulkState(player, { requiredSetBonuses: next }, ['settings']);
};
