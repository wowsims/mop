import { Player } from '@sim/player/player';
import { ActionId } from '@sim/proto/action_id';
import { EquippedItem, ReforgeData } from '@sim/proto/equipped_item';
import { ItemLevelState, ItemQuality, ItemRandomSuffix } from '@generated/proto/common';
import { UIEnchant as Enchant, UIGem as Gem, UIItem as Item } from '@generated/proto/ui';
import { translateProtoStatName, translateStat } from '@i18n/localization';

import { GearData, ItemData } from '../types';

export const itemsTabData = (player: Player<any>, gearData: GearData, items: Item[]): ItemData<Item>[] =>
	items.map(item => {
		const equippedItem = new EquippedItem({ item, challengeMode: player.getChallengeModeEnabled() });
		return {
			item: item,
			id: item.id,
			actionId: equippedItem.asActionId(),
			ilvl: item.scalingOptions?.[ItemLevelState.Base].ilvl || item.ilvl,
			name: item.name,
			searchText: item.name,
			quality: item.quality,
			nameDescription: item.nameDescription,
			phase: item.phase,
			ignoreEPFilter: false,
			onEquip: item => {
				const equippedItem = gearData.getEquippedItem();
				if (equippedItem) {
					gearData.equipItem(equippedItem.withItem(item));
				} else {
					gearData.equipItem(new EquippedItem({ item, challengeMode: player.getChallengeModeEnabled() }));
				}
			},
		};
	});

const byEffectIdDescending = (itemA: Enchant, itemB: Enchant) => {
	if (itemA.effectId > itemB.effectId) return -1;
	if (itemA.effectId < itemB.effectId) return 1;
	return 0;
};

const enchantRow = (enchant: Enchant, equip: (equippedItem: EquippedItem, enchant: Enchant) => EquippedItem, gearData: GearData): ItemData<Enchant> => ({
	item: enchant,
	id: enchant.effectId,
	actionId: enchant.itemId ? ActionId.fromItemId(enchant.itemId) : ActionId.fromSpellId(enchant.spellId),
	name: enchant.name,
	searchText: enchant.name,
	quality: enchant.quality,
	phase: enchant.phase || 1,
	ignoreEPFilter: true,
	nameDescription: '',
	onEquip: enchant => {
		const equippedItem = gearData.getEquippedItem();
		if (equippedItem) gearData.equipItem(equip(equippedItem, enchant));
	},
});

export const enchantsTabData = (gearData: GearData, enchants: Enchant[]): ItemData<Enchant>[] =>
	enchants.sort(byEffectIdDescending).map(enchant => enchantRow(enchant, (equippedItem, value) => equippedItem.withEnchant(value), gearData));

export const tinkersTabData = (gearData: GearData, tinkers: Enchant[]): ItemData<Enchant>[] =>
	tinkers.sort(byEffectIdDescending).map(tinker => enchantRow(tinker, (equippedItem, value) => equippedItem.withTinker(value), gearData));

export const gemsTabData = (gearData: GearData, gems: Gem[], socketIdx: number): ItemData<Gem>[] =>
	gems.map(gem => ({
		item: gem,
		id: gem.id,
		actionId: ActionId.fromItemId(gem.id),
		name: gem.name,
		searchText: gem.name,
		quality: gem.quality,
		phase: gem.phase,
		nameDescription: '',
		ignoreEPFilter: true,
		onEquip: gem => {
			const equippedItem = gearData.getEquippedItem();
			if (equippedItem) gearData.equipItem(equippedItem.withGem(gem, socketIdx));
		},
	}));

export type RandomSuffixNameParts = {
	label: string;
	statString: string;
};

export const randomSuffixesTabData = (
	player: Player<any>,
	gearData: GearData,
	equippedItem: EquippedItem,
	renderName: (parts: RandomSuffixNameParts) => string | HTMLElement,
): ItemData<ItemRandomSuffix>[] => {
	const itemProto = equippedItem.item;
	return player.getRandomSuffixes(itemProto).map((randomSuffix: ItemRandomSuffix) => {
		const equippedItemWithSuffix = equippedItem.withRandomSuffix(randomSuffix).getRandomSuffixStats();
		const statString = equippedItemWithSuffix
			.asProtoArray()
			.map((statValue, statIdx) => {
				if (statValue > 0) {
					return `+${statValue} ${translateStat(statIdx)}`;
				}
				return undefined;
			})
			.filter(Boolean)
			.join(' ');
		const label = translateProtoStatName(randomSuffix.name);

		return {
			item: randomSuffix,
			id: randomSuffix.id,
			actionId: ActionId.fromRandomSuffix(itemProto, randomSuffix),
			name: renderName({ label, statString }),
			searchText: `${label} ${statString}`,
			quality: itemProto.quality,
			phase: itemProto.phase,
			nameDescription: '',
			ignoreEPFilter: true,
			onEquip: randomSuffix => {
				const equippedItem = gearData.getEquippedItem();
				if (equippedItem) {
					gearData.equipItem(equippedItem.withItem(equippedItem.item).withRandomSuffix(randomSuffix));
				}
			},
		};
	});
};

export const reforgesTabData = (
	player: Player<any>,
	gearData: GearData,
	equippedItem: EquippedItem,
	renderName: (reforgeData: ReforgeData) => string | HTMLElement,
): ItemData<ReforgeData>[] => {
	const itemProto = equippedItem.item;
	return player.getAvailableReforgings(equippedItem).map(reforgeData => ({
		item: reforgeData,
		id: reforgeData.id,
		actionId: ActionId.fromReforge(itemProto, reforgeData.reforge),
		name: renderName(reforgeData),
		searchText: `${reforgeData.fromAmount} ${translateStat(reforgeData.fromStat)} +${reforgeData.toAmount} ${translateStat(reforgeData.toStat)}`,
		quality: ItemQuality.ItemQualityCommon,
		phase: itemProto.phase,
		nameDescription: '',
		ignoreEPFilter: true,
		onEquip: reforgeData => {
			const equippedItem = gearData.getEquippedItem();
			if (equippedItem) {
				gearData.equipItem(equippedItem.withReforge(reforgeData.reforge));
			}
		},
	}));
};

export type UpgradeNameParts = {
	index: number;
	ilvlDelta: number;
	upgradeStep: ItemLevelState;
	numberOfUpgrades: number;
};

export const upgradesTabData = (
	gearData: GearData,
	equippedItem: EquippedItem,
	renderName: (parts: UpgradeNameParts) => string | HTMLElement,
): ItemData<ItemLevelState>[] => {
	const itemProto = equippedItem.item;
	const itemUpgradesAsEntries = Object.entries(equippedItem.getUpgrades());
	const numberOfUpgrades = itemUpgradesAsEntries.length - 1;

	return itemUpgradesAsEntries.map(([upgradeStepString, upgradeData], index) => {
		const upgradeStep = Number(upgradeStepString) as ItemLevelState;
		const upgradeItem = equippedItem.withUpgrade(upgradeStep);
		const ilvlDelta = upgradeItem.ilvlFromPrevious * index;
		const stepLabel = `(${upgradeStep}/${numberOfUpgrades})`;

		return {
			item: Number(upgradeStep),
			id: Number(upgradeStep),
			actionId: ActionId.fromItemId(itemProto.id, 0, equippedItem._randomSuffix?.id, 0, upgradeStep),
			name: renderName({ index, ilvlDelta, upgradeStep, numberOfUpgrades }),
			searchText: `${index > 0 ? `+ ${ilvlDelta}` : 'Base'} ${stepLabel}`,
			ilvl: upgradeData.ilvl,
			quality: ItemQuality.ItemQualityCommon,
			phase: itemProto.phase,
			nameDescription: '',
			ignoreEPFilter: true,
			onEquip: upgradeStep => {
				const equippedItem = gearData.getEquippedItem();
				if (equippedItem) {
					gearData.equipItem(equippedItem.withUpgrade(upgradeStep));
				}
			},
		};
	});
};
