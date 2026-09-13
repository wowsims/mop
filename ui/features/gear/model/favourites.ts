import { getUniqueEnchantString } from '@sim/proto/enchants';
import { DatabaseFilters, UIEnchant as Enchant } from '@generated/proto/ui';

import { ItemDataFields, ItemListType, SelectorModalTabs } from '../types';

export const favouriteFilterKey = (tab: SelectorModalTabs): keyof DatabaseFilters | null => {
	switch (tab) {
		case SelectorModalTabs.Items:
			return 'favoriteItems';
		case SelectorModalTabs.Enchants:
		case SelectorModalTabs.Tinkers:
			return 'favoriteEnchants';
		case SelectorModalTabs.Gem1:
		case SelectorModalTabs.Gem2:
		case SelectorModalTabs.Gem3:
			return 'favoriteGems';
		case SelectorModalTabs.RandomSuffixes:
			return 'favoriteRandomSuffixes';
		case SelectorModalTabs.Reforging:
			return 'favoriteReforges';
		default:
			return null;
	}
};

export const favouriteId = <T extends ItemListType>(tab: SelectorModalTabs, itemData: ItemDataFields<T>): number | string => {
	if (tab === SelectorModalTabs.Enchants || tab === SelectorModalTabs.Tinkers) {
		return getUniqueEnchantString(itemData.item as unknown as Enchant);
	}
	return itemData.id;
};

export const isItemFavourited = <T extends ItemListType>(filters: DatabaseFilters, tab: SelectorModalTabs, itemData: ItemDataFields<T>): boolean => {
	const key = favouriteFilterKey(tab);
	if (!key) return false;
	return (filters[key] as never[]).includes(favouriteId(tab, itemData) as never);
};

export const applyFavourite = <T extends ItemListType>(
	filters: DatabaseFilters,
	tab: SelectorModalTabs,
	itemData: ItemDataFields<T>,
	isFavourite: boolean,
): boolean => {
	const key = favouriteFilterKey(tab);
	if (!key) return false;

	const list = filters[key] as never[];
	const id = favouriteId(tab, itemData) as never;
	if (isFavourite) {
		list.push(id);
	} else {
		const idx = list.indexOf(id);
		if (idx !== -1) list.splice(idx, 1);
	}
	return true;
};
