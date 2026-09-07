import { professionNames } from '@sim/proto_utils/names';

import { ItemData, ItemListType } from '../types';

export type NpcNameLookup = (npcId: number) => string | undefined;

export const formatSearchQuery = (value: string): string => value.toLowerCase().replaceAll(/[^a-zA-Z0-9\s]/g, '');

export const itemSourceSearchNames = <T extends ItemListType>(itemData: ItemData<T>, getNpcName: NpcNameLookup): string[] => {
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
			return label?.toLowerCase();
		})
		.filter((name): name is string => !!name);
};

export const matchesSearch = <T extends ItemListType>(query: string, itemData: ItemData<T>, getNpcName: NpcNameLookup): boolean => {
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
