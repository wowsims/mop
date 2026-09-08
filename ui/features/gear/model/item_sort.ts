import { SortDirection } from '@sim/constants/other';
import { ItemLevelState, ItemSlot } from '@generated/proto/common';
import { UIItem as Item } from '@generated/proto/ui';

import { ItemDataFields, ItemListType, SelectorModalTabs } from '../types';

export enum ItemListSortBy {
	EP,
	ILVL,
}

export const defaultSortBy = (slot: ItemSlot, tab: SelectorModalTabs): ItemListSortBy =>
	[ItemSlot.ItemSlotTrinket1, ItemSlot.ItemSlotTrinket2].includes(slot) || tab === SelectorModalTabs.Upgrades ? ItemListSortBy.ILVL : ItemListSortBy.EP;

const baseIlvl = (item: Item): number => item.scalingOptions?.[ItemLevelState.Base].ilvl || item.ilvl;

export type SortOptions<T extends ItemListType> = {
	sortBy: ItemListSortBy;
	sortDirection: SortDirection;
	computeEP: (item: T) => number;
	isFavourited: (itemData: ItemDataFields<T>) => boolean;
};

export const sortItemIdxs = <T extends ItemListType>(
	itemIdxs: Array<number>,
	itemData: Array<ItemDataFields<T>>,
	{ sortBy, sortDirection, computeEP, isFavourited }: SortOptions<T>,
): number[] => {
	const ordered = (itemA: T, itemB: T) =>
		sortDirection === SortDirection.DESC ? ([itemB, itemA] as unknown as [Item, Item]) : ([itemA, itemB] as unknown as [Item, Item]);

	let sortFn = (itemA: T, itemB: T) => {
		const [first, second] = ordered(itemA, itemB);
		const diff = computeEP(first as unknown as T) - computeEP(second as unknown as T);
		// if EP is same, sort by ilvl
		if (Math.abs(diff) < 0.01) return baseIlvl(first) - baseIlvl(second);
		return diff;
	};
	switch (sortBy) {
		case ItemListSortBy.ILVL:
			sortFn = (itemA: T, itemB: T) => {
				const [first, second] = ordered(itemA, itemB);
				return baseIlvl(first) - baseIlvl(second);
			};
			break;
	}

	return itemIdxs.sort((dataA, dataB) => {
		const itemA = itemData[dataA];
		const itemB = itemData[dataB];
		if (isFavourited(itemA) && !isFavourited(itemB)) return -1;
		if (isFavourited(itemB) && !isFavourited(itemA)) return 1;

		return sortFn(itemA.item, itemB.item);
	});
};
