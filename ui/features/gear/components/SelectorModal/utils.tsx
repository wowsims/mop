import { GemColor, ItemLevelState, Profession } from '@generated/proto/common';
import type { ItemSlot } from '@generated/proto/common';
import { translateStat } from '@i18n/localization';
import type { Player } from '@sim/player/player';
import type { EquippedItem } from '@sim/proto/equipped_item';
import { gemMatchesSocket } from '@sim/proto/gems';
import { Stats } from '@sim/proto/stats';
import type { ReactNode } from 'react';

import { enchantsTabData, gemsTabData, itemsTabData, randomSuffixesTabData, reforgesTabData, tinkersTabData, upgradesTabData } from '../../model/item_data';
import type { TabEligibility } from '../../model/tab_eligibility';
import type { GearData, ItemData, ItemListType } from '../../types';
import { SelectorModalTabs } from '../../types';

export interface SelectorTab {
	label: SelectorModalTabs;
	socketColor: GemColor;
	socketIdx?: number;
	itemData: ItemData<ItemListType, ReactNode>[];
	computeEP: (item: ItemListType) => number;
	equippedToItem: (equippedItem: EquippedItem | null) => ItemListType | null | undefined;
	onRemove: () => void;
}

export interface SelectorTabsOptions {
	player: Player<any>;
	slot: ItemSlot;
	gearData: GearData;
	equippedItem: EquippedItem | null;
	isBlacksmithing: boolean;
}

interface TabSpec<T extends ItemListType> {
	label: SelectorModalTabs;
	socketColor?: GemColor;
	socketIdx?: number;
	itemData: ItemData<T, ReactNode>[];
	computeEP: (item: T) => number;
	equippedToItem: (equippedItem: EquippedItem | null) => T | null | undefined;
	onRemove: () => void;
}

// A tab with no rows is not built. The cast is necessary because every tab is uniform apart from
// the type its rows carry.
const describe = <T extends ItemListType>(spec: TabSpec<T>): SelectorTab | null =>
	spec.itemData.length ? ({ socketColor: GemColor.GemColorUnknown, ...spec } as unknown as SelectorTab) : null;

const randomSuffixName = ({ label, statString }: { label: string; statString: string }): ReactNode => (
	<div className="d-flex flex-column">
		{label}
		<span className="fs-content positive mt-1">{statString}</span>
	</div>
);

export const eligibilityFor = ({ player, slot, equippedItem, isBlacksmithing }: Omit<SelectorTabsOptions, 'gearData'>): TabEligibility => ({
	hasEnchants: !!player.getEnchants(slot).length,
	hasReforges: equippedItem?.item ? !!player.getAvailableReforgings(equippedItem).length : false,
	hasUpgrades: !player.getChallengeModeEnabled() && equippedItem?.item ? equippedItem.hasUpgradeOptions() : false,
	socketCount: equippedItem?.numSockets(isBlacksmithing),
});

export const buildSelectorTabs = ({ player, slot, gearData, equippedItem, isBlacksmithing }: SelectorTabsOptions): SelectorTab[] => {
	const tabs: Array<SelectorTab | null> = [
		describe({
			label: SelectorModalTabs.Items,
			itemData: itemsTabData(player, gearData, player.getItems(slot)),
			computeEP: item => player.computeItemEP(item, slot),
			equippedToItem: item => item?.item,
			onRemove: () => gearData.equipItem(null),
		}),
		describe({
			label: SelectorModalTabs.Enchants,
			itemData: enchantsTabData(gearData, player.getEnchants(slot)),
			computeEP: enchant => player.computeEnchantEP(enchant),
			equippedToItem: item => item?.enchant,
			onRemove: () => {
				const current = gearData.getEquippedItem();
				if (current) gearData.equipItem(current.withEnchant(null));
			},
		}),
		player.hasProfession(Profession.Engineering)
			? describe({
					label: SelectorModalTabs.Tinkers,
					itemData: tinkersTabData(gearData, player.getTinkers(slot)),
					computeEP: tinker => player.computeEnchantEP(tinker),
					equippedToItem: item => item?.tinker,
					onRemove: () => {
						const current = gearData.getEquippedItem();
						if (current) gearData.equipItem(current.withTinker(null));
					},
				})
			: null,
		equippedItem?.item.randomSuffixOptions.length
			? describe({
					label: SelectorModalTabs.RandomSuffixes,
					itemData: randomSuffixesTabData(player, gearData, equippedItem, randomSuffixName),
					computeEP: randomSuffix => player.computeRandomSuffixEP(randomSuffix),
					equippedToItem: item => item?.randomSuffix,
					onRemove: () => {
						const current = gearData.getEquippedItem();
						if (current) gearData.equipItem(current.withItem(current.item).withRandomSuffix(null));
					},
				})
			: null,
		equippedItem?.hasUpgradeOptions() && !(equippedItem.hasRandomSuffixOptions() && !equippedItem.randomSuffix)
			? describe({
					label: SelectorModalTabs.Upgrades,
					itemData: upgradesTabData(gearData, equippedItem, ({ index, ilvlDelta, upgradeStep, numberOfUpgrades }) => (
						<>
							{index > 0 ? <>+ {ilvlDelta}</> : <>Base</>}{' '}
							<span className="selector-modal-list-item-upgrade-step-container ms-2">{`(${upgradeStep}/${numberOfUpgrades})`}</span>
						</>
					)),
					computeEP: (upgradeStep: ItemLevelState) => player.computeUpgradeEP(equippedItem, upgradeStep, slot),
					equippedToItem: item => item?._upgrade,
					onRemove: () => {
						const current = gearData.getEquippedItem();
						if (current) gearData.equipItem(current.withUpgrade(ItemLevelState.Base));
					},
				})
			: null,
		equippedItem && !(equippedItem.hasRandomSuffixOptions() && !equippedItem.randomSuffix)
			? describe({
					label: SelectorModalTabs.Reforging,
					itemData: reforgesTabData(player, gearData, equippedItem, reforgeData => (
						<div>
							<span className="reforge-value negative">
								{reforgeData.fromAmount} {translateStat(reforgeData.fromStat)}
							</span>
							<span className="reforge-value positive">
								+{reforgeData.toAmount} {translateStat(reforgeData.toStat)}
							</span>
						</div>
					)),
					computeEP: reforge => player.computeReforgingEP(reforge),
					equippedToItem: item => item?.getReforgeData() || null,
					onRemove: () => {
						const current = gearData.getEquippedItem();
						if (current) gearData.equipItem(current.withItem(current.item).withRandomSuffix(current._randomSuffix));
					},
				})
			: null,
		...gemTabs({ player, slot, gearData, equippedItem, isBlacksmithing }),
	];

	return tabs.filter((tab): tab is SelectorTab => !!tab);
};

const gemTabs = ({ player, gearData, equippedItem, isBlacksmithing }: SelectorTabsOptions): Array<SelectorTab | null> => {
	if (!equippedItem) return [];

	const socketBonusEP = player.computeStatsEP(new Stats(equippedItem.item.socketBonus)) / (equippedItem.item.gemSockets.length || 1);
	return equippedItem.curSocketColors(isBlacksmithing).map((socketColor, socketIdx) =>
		describe({
			label: SelectorModalTabs[`Gem${socketIdx + 1}` as keyof typeof SelectorModalTabs],
			socketColor,
			socketIdx,
			itemData: gemsTabData(gearData, player.getGems(socketColor), socketIdx),
			computeEP: gem => player.computeGemEP(gem) + (gemMatchesSocket(gem, socketColor) ? socketBonusEP : 0),
			equippedToItem: item => item?.gems[socketIdx],
			onRemove: () => {
				const current = gearData.getEquippedItem();
				if (current) gearData.equipItem(current.withGem(null, socketIdx));
			},
		}),
	);
};

export const removeButtonLabel = (label: SelectorModalTabs, translate: (key: string) => string): string => {
	switch (label) {
		case SelectorModalTabs.Enchants:
			return translate('gear_tab.gear_picker.remove_buttons.remove_enchant');
		case SelectorModalTabs.Tinkers:
			return translate('gear_tab.gear_picker.remove_buttons.remove_tinkers');
		case SelectorModalTabs.Reforging:
			return translate('gear_tab.gear_picker.remove_buttons.remove_reforge');
		case SelectorModalTabs.RandomSuffixes:
			return translate('gear_tab.gear_picker.remove_buttons.remove_random_suffix');
		case SelectorModalTabs.Upgrades:
			return translate('gear_tab.gear_picker.remove_buttons.remove_upgrade');
		case SelectorModalTabs.Gem1:
		case SelectorModalTabs.Gem2:
		case SelectorModalTabs.Gem3:
			return translate('gear_tab.gear_picker.remove_buttons.remove_gem');
		default:
			return translate('gear_tab.gear_picker.unequip_item');
	}
};

export const columnHeaderLabel = (label: SelectorModalTabs, translate: (tab: SelectorModalTabs) => string): string => {
	if ([SelectorModalTabs.Gem1, SelectorModalTabs.Gem2, SelectorModalTabs.Gem3].includes(label)) return translate(SelectorModalTabs.Gem1);
	if (
		[SelectorModalTabs.Items, SelectorModalTabs.Enchants, SelectorModalTabs.Reforging, SelectorModalTabs.Upgrades, SelectorModalTabs.Tinkers].includes(
			label,
		)
	) {
		return translate(label);
	}
	return '';
};
