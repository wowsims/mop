import { professionNames } from '@sim/proto/names';

import { ItemDataFields, ItemListType } from '../types';

export type NpcNameLookup = (npcId: number) => string | undefined;

export const formatSearchQuery = (value: string): string =>
	value
		.normalize('NFD')
		.replaceAll(/\p{Diacritic}/gu, '')
		.toLowerCase()
		.replaceAll(/[^\p{L}\p{N}\s]/gu, '');

export const itemSourceSearchNames = <T extends ItemListType>(itemData: ItemDataFields<T>, getNpcName: NpcNameLookup): string[] => {
	if (!('item' in itemData) || typeof itemData.item != 'object' || !('sources' in itemData.item)) return [];
	return itemData.item.sources
		.map(src => {
			let label = undefined;
			const source = src.source;
			if (source.oneofKind === 'drop') {
				label = getNpcName(source.drop.npcId) || source.drop.otherName;
			} else if (source.oneofKind === 'soldBy') {
				label = source.soldBy.npcName;
			} else if (source.oneofKind === 'crafted') {
				label = professionNames.get(source.crafted.profession);
			}
			return label && formatSearchQuery(label);
		})
		.filter((name): name is string => !!name);
};

export const matchesSearch = <T extends ItemListType>(query: string, itemData: ItemDataFields<T>, getNpcName: NpcNameLookup): boolean => {
	if (!query.length) return true;

	const searchQuery = formatSearchQuery(query).split(' ');
	const name = formatSearchQuery(itemData.searchText);
	const nameDescription = formatSearchQuery(itemData.nameDescription);
	const sourceNames = itemSourceSearchNames(itemData, getNpcName);

	for (const term of searchQuery) {
		if (!name.includes(term) && !nameDescription.includes(term) && !sourceNames.some(sourceName => sourceName.includes(term))) {
			return false;
		}
	}
	return true;
};
