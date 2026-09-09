import { ItemLevelState } from '@generated/proto/common';
import type { UIItem } from '@generated/proto/ui';

export const MAX_SEARCH_RESULTS = 21;

export interface BulkSearchResult {
	/** At most `MAX_SEARCH_RESULTS` items, in the order the list was given. */
	items: UIItem[];
	/** Every match, so the list can say how many it is not showing. */
	matchCount: number;
}

export const baseIlvl = (item: UIItem): number => item.scalingOptions?.[ItemLevelState.Base].ilvl || item.ilvl;

/** Highest item level first, which is the order the search list is built in. */
export const byIlvlDescending = (a: UIItem, b: UIItem): number => baseIlvl(b) - baseIlvl(a);

export const searchBulkItems = (allItems: readonly UIItem[], query: string, minIlvl: number, maxIlvl: number): BulkSearchResult => {
	const pieces = query.split(' ').map(piece => piece.toLowerCase());
	const items: UIItem[] = [];
	let matchCount = 0;

	for (const item of allItems) {
		const ilvl = baseIlvl(item);
		if (maxIlvl != 0 && maxIlvl < ilvl) continue;
		if (minIlvl != 0 && minIlvl > ilvl) continue;

		const lcName = item.name.toLowerCase();
		const lcSetName = item.setName.toLowerCase();
		if (!pieces.every(piece => lcName.includes(piece) || lcSetName.includes(piece))) continue;

		matchCount++;
		if (matchCount <= MAX_SEARCH_RESULTS) items.push(item);
	}

	return { items, matchCount };
};
