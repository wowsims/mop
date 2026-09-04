// What a player may equip: item and enchant eligibility, weapon-type rules and
// the gear identity keys the reforge cache is keyed on.
import { EnchantType, EquipmentSpec, HandType, ItemSlot, ItemType, Profession, RangedWeaponType, Spec, WeaponType } from '@generated/proto/common';
import { UIEnchant as Enchant, UIGem as Gem, UIItem as Item } from '@generated/proto/ui';

import { intersection, swap } from '../collections';
import { PlayerSpec } from '../player_spec';
import { PlayerSpecs } from '../player_specs';
import { Stats } from './stats';

export function isSharpWeaponType(weaponType: WeaponType): boolean {
	return [WeaponType.WeaponTypeAxe, WeaponType.WeaponTypeDagger, WeaponType.WeaponTypePolearm, WeaponType.WeaponTypeSword].includes(weaponType);
}

export function isBluntWeaponType(weaponType: WeaponType): boolean {
	return [WeaponType.WeaponTypeFist, WeaponType.WeaponTypeMace, WeaponType.WeaponTypeStaff].includes(weaponType);
}

// Custom functions for determining the EP value of meta gem effects.
// Default meta effect EP value is 0, so just handle the ones relevant to your spec.
const metaGemEffectEPs: Partial<Record<Spec, (gem: Gem, playerStats: Stats) => number>> = {};

export function getMetaGemEffectEP<SpecType extends Spec>(playerSpec: PlayerSpec<SpecType>, gem: Gem, playerStats: Stats) {
	if (metaGemEffectEPs[playerSpec.specID]) {
		return metaGemEffectEPs[playerSpec.specID]!(gem, playerStats);
	} else {
		return 0;
	}
}

// Returns true if this item may be equipped in at least 1 slot for the given Spec.
export function canEquipItem<SpecType extends Spec>(item: Item, playerSpec: PlayerSpec<SpecType>, slot: ItemSlot | undefined): boolean {
	const playerClass = PlayerSpecs.getPlayerClass(playerSpec);
	if (item.classAllowlist.length > 0 && !item.classAllowlist.includes(playerClass.classID)) {
		return false;
	}

	if ([ItemType.ItemTypeFinger, ItemType.ItemTypeTrinket].includes(item.type)) {
		return true;
	}

	if (item.type == ItemType.ItemTypeWeapon) {
		const eligibleWeaponType = playerClass.weaponTypes.find(wt => wt.weaponType == item.weaponType);
		if (!eligibleWeaponType) {
			return false;
		}

		if (
			(item.handType == HandType.HandTypeOffHand || (item.handType == HandType.HandTypeOneHand && slot == ItemSlot.ItemSlotOffHand)) &&
			![WeaponType.WeaponTypeShield, WeaponType.WeaponTypeOffHand].includes(item.weaponType) &&
			!playerSpec.canDualWield
		) {
			return false;
		}

		if (item.handType == HandType.HandTypeTwoHand && !eligibleWeaponType.canUseTwoHand) {
			return false;
		}
		if (item.handType == HandType.HandTypeTwoHand && slot == ItemSlot.ItemSlotOffHand && playerSpec.specID != Spec.SpecFuryWarrior) {
			return false;
		}

		return true;
	}

	if (item.type == ItemType.ItemTypeRanged) {
		return playerClass.rangedWeaponTypes.includes(item.rangedWeaponType);
	}

	// At this point, we know the item is an armor piece (feet, chest, legs, etc).
	return playerClass.armorTypes[0] >= item.armorType;
}

const pvpSeasonFromName: Record<string, string> = {
	Wrathful: 'Season 8',
	Bloodthirsty: 'Season 8.5',
	Vicious: 'Season 9',
	Ruthless: 'Season 10',
	Cataclysmic: 'Season 11',
};

export const isPVPItem = (item: Item) => item?.name?.includes('Gladiator') || false;

export const getPVPSeasonFromItem = (item: Item) => {
	const seasonName = item.name.substring(0, item.name.indexOf(' '));
	return pvpSeasonFromName[seasonName] || undefined;
};

const itemTypeToSlotsMap: Partial<Record<ItemType, Array<ItemSlot>>> = {
	[ItemType.ItemTypeUnknown]: [],
	[ItemType.ItemTypeHead]: [ItemSlot.ItemSlotHead],
	[ItemType.ItemTypeNeck]: [ItemSlot.ItemSlotNeck],
	[ItemType.ItemTypeShoulder]: [ItemSlot.ItemSlotShoulder],
	[ItemType.ItemTypeBack]: [ItemSlot.ItemSlotBack],
	[ItemType.ItemTypeChest]: [ItemSlot.ItemSlotChest],
	[ItemType.ItemTypeWrist]: [ItemSlot.ItemSlotWrist],
	[ItemType.ItemTypeHands]: [ItemSlot.ItemSlotHands],
	[ItemType.ItemTypeWaist]: [ItemSlot.ItemSlotWaist],
	[ItemType.ItemTypeLegs]: [ItemSlot.ItemSlotLegs],
	[ItemType.ItemTypeFeet]: [ItemSlot.ItemSlotFeet],
	[ItemType.ItemTypeFinger]: [ItemSlot.ItemSlotFinger1, ItemSlot.ItemSlotFinger2],
	[ItemType.ItemTypeTrinket]: [ItemSlot.ItemSlotTrinket1, ItemSlot.ItemSlotTrinket2],
	[ItemType.ItemTypeRanged]: [ItemSlot.ItemSlotMainHand],
};

export function getEligibleItemSlots(item: Item, canDualWield2H?: boolean): Array<ItemSlot> {
	if (itemTypeToSlotsMap[item.type]) {
		return itemTypeToSlotsMap[item.type]!;
	}

	if (item.type == ItemType.ItemTypeWeapon) {
		if (canDualWield2H) {
			return [ItemSlot.ItemSlotMainHand, ItemSlot.ItemSlotOffHand];
		}

		if (item.handType == HandType.HandTypeMainHand) {
			return [ItemSlot.ItemSlotMainHand];
		} else if (item.handType == HandType.HandTypeOffHand) {
			return [ItemSlot.ItemSlotOffHand];
		} else {
			return [ItemSlot.ItemSlotMainHand, ItemSlot.ItemSlotOffHand];
		}
	}

	// Should never reach here
	throw new Error('Could not find item slots for item: ' + Item.toJsonString(item));
}

export const isSecondaryItemSlot = (slot: ItemSlot) => slot === ItemSlot.ItemSlotFinger2 || slot === ItemSlot.ItemSlotTrinket2;

// Returns whether the given main-hand and off-hand items can be worn at the
// same time.
export function validWeaponCombo(mainHand: Item | null | undefined, offHand: Item | null | undefined, canDW2h: boolean): boolean {
	if (canDW2h) {
		return true;
	}

	return mainHand?.handType != HandType.HandTypeTwoHand && offHand?.handType != HandType.HandTypeTwoHand;
}

export function getEligibleEnchantSlots(enchant: Enchant): Array<ItemSlot> {
	return [enchant.type]
		.concat(enchant.extraTypes || [])
		.map(type => {
			if (itemTypeToSlotsMap[type]) {
				return itemTypeToSlotsMap[type]!;
			}

			if (type == ItemType.ItemTypeWeapon) {
				return [ItemSlot.ItemSlotMainHand, ItemSlot.ItemSlotOffHand];
			}

			// Should never reach here
			throw new Error('Could not find item slots for enchant: ' + Enchant.toJsonString(enchant));
		})
		.flat();
}

export function enchantAppliesToItem(enchant: Enchant, item: Item): boolean {
	const sharedSlots = intersection(getEligibleEnchantSlots(enchant), getEligibleItemSlots(item));
	if (!sharedSlots.length) return false;

	if (enchant.enchantType === EnchantType.EnchantTypeTwoHand && item.handType !== HandType.HandTypeTwoHand) return false;

	if (enchant.enchantType === EnchantType.EnchantTypeStaff && item.weaponType !== WeaponType.WeaponTypeStaff) return false;

	if (enchant.enchantType === EnchantType.EnchantTypeShield && item.weaponType !== WeaponType.WeaponTypeShield) return false;

	if (
		(enchant.enchantType === EnchantType.EnchantTypeOffHand) !==
		(item.weaponType === WeaponType.WeaponTypeOffHand ||
			// All off-hand enchants can be applied to shields as well
			(item.weaponType === WeaponType.WeaponTypeShield && enchant.enchantType !== EnchantType.EnchantTypeShield))
	)
		return false;

	if (enchant.type == ItemType.ItemTypeRanged) {
		if (
			![RangedWeaponType.RangedWeaponTypeBow, RangedWeaponType.RangedWeaponTypeCrossbow, RangedWeaponType.RangedWeaponTypeGun].includes(
				item.rangedWeaponType,
			)
		)
			return false;
	}

	if (item.rangedWeaponType != RangedWeaponType.RangedWeaponTypeWand && item.rangedWeaponType > 0 && enchant.type != ItemType.ItemTypeRanged) {
		return false;
	}

	return true;
}

export function canEquipEnchant<SpecType extends Spec>(enchant: Enchant, playerSpec: PlayerSpec<SpecType>): boolean {
	if (enchant.classAllowlist.length > 0 && !enchant.classAllowlist.includes(playerSpec.classID)) {
		return false;
	}

	// This is a Tinker and we handle them differently
	if (enchant.requiredProfession == Profession.Engineering) {
		return false;
	}

	return true;
}

export function getGearIdentityKey(spec: EquipmentSpec): string {
	return buildGearKey(spec);
}

/**
 * Cache key for a reforge-optimizer result: everything the optimizer's output depends on.
 * That means every equipped gem — with includeGems off the optimizer keeps them, and with
 * it on minimizeRegems reuses them — plus the reforge and frozen state of each frozen slot.
 */
export function getReforgeCacheGearKey(spec: EquipmentSpec, frozenItemSlots?: readonly ItemSlot[]): string {
	return buildGearKey(spec, frozenItemSlots, true);
}

function buildGearKey(spec: EquipmentSpec, frozenItemSlots?: readonly ItemSlot[], includeExistingGems = false): string {
	const items = spec.items;
	const frozenSlots = frozenItemSlots ?? [];
	const frozenSlotMask = frozenSlots.length ? new Uint8Array(items.length) : undefined;
	if (frozenSlotMask) {
		for (let i = 0; i < frozenSlots.length; i++) {
			const slot = frozenSlots[i];
			if (slot >= 0 && slot < items.length) {
				frozenSlotMask[slot] = 1;
			}
		}
	}
	const itemKeys = new Array<string>(items.length);
	for (let slotIdx = 0; slotIdx < items.length; slotIdx++) {
		const item = items[slotIdx];
		if (!item?.id) {
			itemKeys[slotIdx] = '';
			continue;
		}

		const itemSlot = slotIdx as ItemSlot;
		const isFrozen = !!frozenSlotMask?.[itemSlot];
		const gemFingerprint =
			isFrozen || includeExistingGems
				? (item.gems ?? []).map(gemId => gemId ?? 0).join(',')
				: String(itemSlot === ItemSlot.ItemSlotHead ? (item.gems?.[0] ?? 0) : 0);
		const reforgeFingerprint = isFrozen ? (item.reforging ?? 0) : 0;
		itemKeys[slotIdx] = [
			item.id,
			item.randomSuffix ?? 0,
			item.enchant ?? 0,
			item.tinker ?? 0,
			reforgeFingerprint,
			item.upgradeStep ?? 0,
			gemFingerprint,
			Number(item.challengeMode ?? false),
		].join(':');
		// Frozen-ness has to travel with the item through the paired-slot normalization
		// below, or swapping two rings with one of them frozen collapses to a single key
		// while the optimizer (which freezes by slot index) must leave a different ring
		// alone in each case. Appended rather than joined in so unfrozen keys - the ones
		// already in users' caches - stay byte-identical.
		if (isFrozen) {
			itemKeys[slotIdx] += ':frozen';
		}
	}

	const reorderPairedSlots = (firstSlot: ItemSlot, secondSlot: ItemSlot): void => {
		if (itemKeys[firstSlot] > itemKeys[secondSlot]) {
			swap(itemKeys, firstSlot, secondSlot);
		}
	};

	// Normalize interchangeable slots so equivalent gear layouts share a cache key.
	reorderPairedSlots(ItemSlot.ItemSlotFinger1, ItemSlot.ItemSlotFinger2);
	reorderPairedSlots(ItemSlot.ItemSlotTrinket1, ItemSlot.ItemSlotTrinket2);

	return itemKeys.join('|');
}
