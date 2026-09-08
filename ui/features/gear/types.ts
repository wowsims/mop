import { ActionId } from '@sim/proto/action_id';
import { EquippedItem, ReforgeData } from '@sim/proto/equipped_item';
import { StoreSubscribe } from '@sim/state/subscriptions';
import { ItemLevelState, ItemQuality, ItemRandomSuffix, ItemSlot } from '@generated/proto/common';
import { UIEnchant as Enchant, UIGem as Gem, UIItem as Item } from '@generated/proto/ui';
import i18n from '@i18n/config';

export type ItemListType = Item | Enchant | Gem | ReforgeData | ItemRandomSuffix | ItemLevelState;

export interface ItemData<T extends ItemListType> {
	item: T;
	name: string | HTMLElement;
	searchText: string;
	id: number;
	actionId: ActionId;
	quality: ItemQuality;
	phase: number;
	ilvl?: number;
	ignoreEPFilter: boolean;
	nameDescription: string;
	onEquip: (item: T) => void;
}

export interface GearData {
	equipItem: (equippedItem: EquippedItem | null) => void;
	getEquippedItem: () => EquippedItem | null;
	// Fires when the equipped item for this slot changes.
	subscribe: StoreSubscribe;
}

export enum SelectorModalTabs {
	Items = 'Items',
	RandomSuffixes = 'Random Suffix',
	Enchants = 'Enchants',
	Tinkers = 'Tinkers',
	Reforging = 'Reforging',
	Upgrades = 'Upgrades',
	Gem1 = 'Gem1',
	Gem2 = 'Gem2',
	Gem3 = 'Gem3',
}

// Helper function to get translated tab labels
export function getTranslatedTabLabel(tab: SelectorModalTabs): string {
	switch (tab) {
		case SelectorModalTabs.Items:
			return i18n.t('gear_tab.gear_picker.tabs.items');
		case SelectorModalTabs.RandomSuffixes:
			return i18n.t('gear_tab.gear_picker.tabs.random_suffix');
		case SelectorModalTabs.Enchants:
			return i18n.t('gear_tab.gear_picker.tabs.enchants');
		case SelectorModalTabs.Tinkers:
			return i18n.t('gear_tab.gear_picker.tabs.tinkers');
		case SelectorModalTabs.Reforging:
			return i18n.t('gear_tab.gear_picker.tabs.reforging');
		case SelectorModalTabs.Upgrades:
			return i18n.t('gear_tab.gear_picker.tabs.upgrades');
		case SelectorModalTabs.Gem1:
			return i18n.t('gear_tab.gear_picker.tabs.gem1');
		case SelectorModalTabs.Gem2:
			return i18n.t('gear_tab.gear_picker.tabs.gem2');
		case SelectorModalTabs.Gem3:
			return i18n.t('gear_tab.gear_picker.tabs.gem3');
		default:
			return tab;
	}
}

export interface SelectorModalOpener {
	openTab(selectedSlot: ItemSlot, selectedTab: SelectorModalTabs, gearData: GearData): void;
}

export interface SlotRailEntry {
	slot: ItemSlot;
	getItem: () => EquippedItem | null;
	subscribe: StoreSubscribe;
	open: (tab: SelectorModalTabs) => void;
}
