// Building the trimmed SimDatabase a bulk run ships to the workers.
import { ItemRandomSuffix, ItemSpec, ReforgeStat } from '@generated/proto/common';
import { ItemEffectRandPropPoints, SimDatabase, SimEnchant, SimGem, SimItem } from '@generated/proto/db';
import { UIEnchant as Enchant, UIGem as Gem, UIItem as Item } from '@generated/proto/ui';

import { Database } from '../proto_utils/database';
import { EquippedItem } from '../proto_utils/equipped_item';
import { Gear } from '../proto_utils/gear';

export const makeBulkGearDatabase = (db: Database, gearSets: Gear[], extraItems: EquippedItem[] = []): SimDatabase => {
	const items = new Map<number, Item>();
	const randomSuffixes = new Map<number, ItemRandomSuffix>();
	const reforgeStats = new Map<number, ReforgeStat>();
	const itemEffectRandPropPoints = new Map<number, ItemEffectRandPropPoints>();
	const enchants = new Map<number, Enchant>();
	const gems = new Map<number, Gem>();

	const addEquippedItem = (equippedItem: EquippedItem) => {
		const item = equippedItem.item;
		items.set(item.id, item);

		const randomSuffix = equippedItem.randomSuffix;
		if (randomSuffix) randomSuffixes.set(randomSuffix.id, randomSuffix);

		const itemReforge = equippedItem.reforge;
		if (itemReforge) {
			const reforge = db.getReforgeById(itemReforge.id);
			if (reforge) reforgeStats.set(reforge.id, reforge);
		}

		const scalingIlvls = new Set([equippedItem.ilvl]);
		Object.values(item.scalingOptions ?? {}).forEach(opt => {
			if (opt?.ilvl) scalingIlvls.add(opt.ilvl);
		});
		scalingIlvls.forEach(ilvl => {
			const rpp = db.getItemEffectRandPropPoints(ilvl);
			if (rpp) itemEffectRandPropPoints.set(rpp.ilvl, rpp);
		});

		const enchant = equippedItem.enchant;
		if (enchant) enchants.set(enchant.effectId, enchant);

		const tinker = equippedItem.tinker;
		if (tinker) enchants.set(tinker.effectId, tinker);

		for (const gem of equippedItem.gems) {
			if (gem) gems.set(gem.id, gem);
		}
	};

	for (const gearSet of gearSets) {
		for (const equippedItem of gearSet.asArray()) {
			if (equippedItem) addEquippedItem(equippedItem);
		}
	}
	for (const equippedItem of extraItems) {
		addEquippedItem(equippedItem);
	}

	return SimDatabase.create({
		items: Array.from(items.values()).map(item => SimItem.fromJson(Item.toJson(item), { ignoreUnknownFields: true })),
		randomSuffixes: Array.from(randomSuffixes.values()),
		reforgeStats: Array.from(reforgeStats.values()),
		itemEffectRandPropPoints: Array.from(itemEffectRandPropPoints.values()),
		enchants: Array.from(enchants.values()).map(enchant => SimEnchant.fromJson(Enchant.toJson(enchant), { ignoreUnknownFields: true })),
		gems: Array.from(gems.values()).map(gem => SimGem.fromJson(Gem.toJson(gem), { ignoreUnknownFields: true })),
	});
};

export const makeBulkItemDatabaseFromSpecs = (db: Database, baselineGear: Gear, itemSpecs: readonly ItemSpec[]): SimDatabase => {
	const extraItems = itemSpecs.map(itemSpec => (itemSpec ? db.lookupItemSpec(itemSpec) : null)).filter((item): item is EquippedItem => item != null);
	return makeBulkGearDatabase(db, [baselineGear], extraItems);
};
