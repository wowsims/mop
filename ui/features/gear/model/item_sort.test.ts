import { SortDirection } from '@domain/constants/other';
import { ItemSlot } from '@generated/proto/common';
import { UIItem as Item } from '@generated/proto/ui';
import { describe, expect, it } from 'vitest';

import { ItemData, SelectorModalTabs } from '../types';
import { defaultSortBy, ItemListSortBy, sortItemIdxs } from './item_sort';

const row = (id: number, ilvl: number, scalingIlvl?: number): ItemData<Item> =>
	({
		item: { id, ilvl, scalingOptions: scalingIlvl === undefined ? undefined : { 0: { ilvl: scalingIlvl } } } as unknown as Item,
		id,
		ilvl,
		name: String(id),
		searchText: String(id),
		nameDescription: '',
		phase: 1,
		quality: 0,
		ignoreEPFilter: false,
		actionId: null,
		onEquip: () => {},
	}) as unknown as ItemData<Item>;

const sort = (rows: ItemData<Item>[], over: Partial<Parameters<typeof sortItemIdxs<Item>>[2]> = {}) =>
	sortItemIdxs(
		rows.map((_, i) => i),
		rows,
		{
			sortBy: ItemListSortBy.ILVL,
			sortDirection: SortDirection.DESC,
			computeEP: () => 0,
			isFavourited: () => false,
			...over,
		},
	);

describe('defaultSortBy', () => {
	it('is EP for an ordinary slot on the Items tab', () => {
		expect(defaultSortBy(ItemSlot.ItemSlotHead, SelectorModalTabs.Items)).toBe(ItemListSortBy.EP);
	});

	it('is ilvl on both trinket slots, whose EP is not comparable', () => {
		expect(defaultSortBy(ItemSlot.ItemSlotTrinket1, SelectorModalTabs.Items)).toBe(ItemListSortBy.ILVL);
		expect(defaultSortBy(ItemSlot.ItemSlotTrinket2, SelectorModalTabs.Enchants)).toBe(ItemListSortBy.ILVL);
	});

	it('is ilvl on the Upgrades tab whatever the slot', () => {
		expect(defaultSortBy(ItemSlot.ItemSlotHead, SelectorModalTabs.Upgrades)).toBe(ItemListSortBy.ILVL);
	});

	it('depends on nothing but the slot and the tab', () => {
		expect(defaultSortBy(ItemSlot.ItemSlotHead, SelectorModalTabs.Items)).toBe(defaultSortBy(ItemSlot.ItemSlotHead, SelectorModalTabs.Items));
	});
});

describe('sortItemIdxs', () => {
	it('sorts by ilvl descending, preferring the base scaling ilvl', () => {
		expect(sort([row(1, 100), row(2, 500, 480), row(3, 200)])).toEqual([1, 2, 0]);
	});

	it('reverses on ASC', () => {
		expect(sort([row(1, 100), row(2, 300), row(3, 200)], { sortDirection: SortDirection.ASC })).toEqual([0, 2, 1]);
	});

	it('sorts by EP and breaks near-ties on ilvl', () => {
		const rows = [row(1, 100), row(2, 200), row(3, 400)];
		const ep = new Map([
			[1, 10],
			[2, 10.005],
			[3, 5],
		]);
		expect(sort(rows, { sortBy: ItemListSortBy.EP, computeEP: item => ep.get(item.id)! })).toEqual([1, 0, 2]);
	});

	it('floats favourites above everything else', () => {
		const rows = [row(1, 100), row(2, 500), row(3, 200)];
		expect(sort(rows, { isFavourited: itemData => itemData.id === 1 })).toEqual([0, 1, 2]);
	});

	it('sorts the array it is given, in place', () => {
		const rows = [row(1, 100), row(2, 500)];
		const idxs = [0, 1];
		expect(
			sortItemIdxs(idxs, rows, { sortBy: ItemListSortBy.ILVL, sortDirection: SortDirection.DESC, computeEP: () => 0, isFavourited: () => false }),
		).toBe(idxs);
		expect(idxs).toEqual([1, 0]);
	});
});
