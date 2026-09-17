import { ItemLevelState } from '@generated/proto/common';
import type { UIItem } from '@generated/proto/ui';
import { describe, expect, it } from 'vitest';

import { baseIlvl, byIlvlDescending, MAX_SEARCH_RESULTS, searchBulkItems } from './search';

const item = (name: string, ilvl: number, setName = '', baseOverride?: number) =>
	({
		name,
		setName,
		ilvl,
		scalingOptions: baseOverride === undefined ? undefined : { [ItemLevelState.Base]: { ilvl: baseOverride } },
	}) as unknown as UIItem;

describe('searchBulkItems', () => {
	const items = [item('Bloodied Chestguard', 500), item('Ancient Legguards', 480, 'Bloodied Regalia'), item('Boots of Speed', 460)];

	it('matches on the name and on the set name, and needs every word', () => {
		expect(searchBulkItems(items, 'bloodied', 0, 0).items.map(i => i.name)).toEqual(['Bloodied Chestguard', 'Ancient Legguards']);
		expect(searchBulkItems(items, 'bloodied chest', 0, 0).items.map(i => i.name)).toEqual(['Bloodied Chestguard']);
		expect(searchBulkItems(items, 'bloodied speed', 0, 0).items).toEqual([]);
	});

	it('applies the item-level bounds, treating zero as no bound', () => {
		expect(searchBulkItems(items, 'o', 470, 0).items.map(i => i.name)).toEqual(['Bloodied Chestguard', 'Ancient Legguards']);
		expect(searchBulkItems(items, 'o', 0, 470).items.map(i => i.name)).toEqual(['Boots of Speed']);
		expect(searchBulkItems(items, 'o', 470, 490).items.map(i => i.name)).toEqual(['Ancient Legguards']);
	});

	it('caps the list but counts every match, so the note can say what it is not showing', () => {
		const many = Array.from({ length: MAX_SEARCH_RESULTS + 5 }, (_, index) => item(`Cloak ${index}`, 400));
		const result = searchBulkItems(many, 'cloak', 0, 0);

		expect(result.items).toHaveLength(MAX_SEARCH_RESULTS);
		expect(result.matchCount).toBe(MAX_SEARCH_RESULTS + 5);
	});

	it('filters and sorts on the base scaling level where an item has one', () => {
		const upgraded = item('Upgraded Belt', 540, '', 490);

		expect(baseIlvl(upgraded)).toBe(490);
		expect(searchBulkItems([upgraded], 'belt', 0, 500).items).toHaveLength(1);
		expect([item('a', 100), item('b', 300), upgraded].sort(byIlvlDescending).map(i => i.name)).toEqual(['Upgraded Belt', 'b', 'a']);
	});
});
