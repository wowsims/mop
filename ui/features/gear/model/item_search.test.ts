import { UIItem as Item, UIItem_FactionRestriction } from '@generated/proto/ui';
import { describe, expect, it } from 'vitest';

import { ItemData, ItemListType } from '../types';
import { formatSearchQuery, itemSourceSearchNames, matchesSearch } from './item_search';

const row = <T extends ItemListType>(over: Partial<ItemData<T>> & { item: T }): ItemData<T> =>
	({
		name: '',
		searchText: '',
		nameDescription: '',
		id: 1,
		phase: 1,
		quality: 0,
		ignoreEPFilter: false,
		actionId: null,
		onEquip: () => {},
		...over,
	}) as unknown as ItemData<T>;

const item = (over: Partial<Item> = {}): Item =>
	({
		id: 1,
		name: '',
		sources: [],
		factionRestriction: UIItem_FactionRestriction.UNSPECIFIED,
		...over,
	}) as unknown as Item;

const noNpc = () => undefined;

describe('formatSearchQuery', () => {
	it('lower-cases and drops punctuation but keeps whitespace', () => {
		expect(formatSearchQuery("Sha'tar Ring, Heroic")).toBe('shatar ring heroic');
	});

	it('folds accents to their base letter, so an unaccented query still hits', () => {
		expect(formatSearchQuery('Épée de Justice')).toBe('epee de justice');
		expect(matchesSearch('epee', row({ item: item(), searchText: 'Épée de Justice' }), noNpc)).toBe(true);
	});

	it('keeps non-Latin letters rather than collapsing the query to a match-everything empty string', () => {
		expect(formatSearchQuery('龙牙')).toBe('龙牙');
		expect(matchesSearch('龙牙', row({ item: item(), searchText: 'Gauntlets of the Shadowy Conqueror' }), noNpc)).toBe(false);
	});
});

describe('matchesSearch', () => {
	it('accepts everything when the query is empty', () => {
		expect(matchesSearch('', row({ item: item(), searchText: 'anything' }), noNpc)).toBe(true);
	});

	it('requires every whitespace-separated term to hit somewhere', () => {
		const entry = row({ item: item(), searchText: 'Gauntlets of the Shadowy Conqueror' });
		expect(matchesSearch('shadowy conqueror', entry, noNpc)).toBe(true);
		expect(matchesSearch('shadowy paladin', entry, noNpc)).toBe(false);
	});

	it('matches the name description as well as the name', () => {
		const entry = row({ item: item(), searchText: 'Bracers of Defiled Earth', nameDescription: 'Heroic Thunderforged' });
		expect(matchesSearch('thunderforged', entry, noNpc)).toBe(true);
	});

	it('matches a drop source npc name, and falls back to otherName', () => {
		const dropped = row({
			item: item({ sources: [{ source: { oneofKind: 'drop', drop: { npcId: 7, zoneId: 1, otherName: 'Trash', difficulty: 0, category: '' } } }] }),
			searchText: 'Some Item',
		});
		expect(matchesSearch('garrosh', dropped, npcId => (npcId === 7 ? 'Garrosh Hellscream' : undefined))).toBe(true);
		expect(matchesSearch('trash', dropped, noNpc)).toBe(true);
	});

	it('reads searchText, never the display name — defect 1', () => {
		const nameElem = { toString: () => '[object HTMLDivElement]' } as unknown as HTMLElement;
		const entry = row({ item: item(), name: nameElem, searchText: '+320 Haste' });

		expect(matchesSearch('haste', entry, noNpc)).toBe(true);
		expect(matchesSearch('agility', entry, noNpc)).toBe(false);
		expect(matchesSearch('htmldivelement', entry, noNpc)).toBe(false);
	});
});

describe('itemSourceSearchNames', () => {
	it('is empty for a tab whose item is not an Item proto', () => {
		expect(itemSourceSearchNames(row({ item: 3 as unknown as ItemListType }), noNpc)).toEqual([]);
	});

	it('folds vendor names the same way as the query, so punctuation cannot block a match', () => {
		const entry = row({
			item: item({ sources: [{ source: { oneofKind: 'soldBy', soldBy: { npcId: 2, npcName: "Sha'tari Quartermaster", zoneId: 1 } } }] }),
		});
		expect(itemSourceSearchNames(entry, noNpc)).toEqual(['shatari quartermaster']);
		expect(matchesSearch("sha'tari", entry, noNpc)).toBe(true);
	});
});
