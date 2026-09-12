import { describe, expect, it } from 'vitest';

import { sameItems, visibleItems } from './row_track';
import type { ContentRow, RowItem } from './types';

const span = (start: number, end: number) => ({ kind: 'aura', start, end }) as RowItem;

// [0,1] [2,3] [4,20] [5,6] [7,8] — the third is long enough to still be on screen when the ones
// after it are not, which is what `maxRightUpTo` exists to find.
const ITEMS = [span(0, 1), span(2, 3), span(4, 20), span(5, 6), span(7, 8)];
const row = { items: ITEMS, maxRightUpTo: [1, 3, 20, 20, 20] } as ContentRow;

describe('visibleItems', () => {
	it('returns the overlapping items, ascending', () => {
		expect(visibleItems(row, 4.5, 6.5, 1)).toEqual([2, 3]);
	});

	it('keeps an item whose span reaches into the window from before an item that does not', () => {
		// index 3 ends at 6, left of the window; index 2 runs to 20 and still covers it.
		expect(visibleItems(row, 7.5, 9, 1)).toEqual([2, 4]);
	});

	it('stops walking back once no earlier item can still reach the window', () => {
		// Nothing before index 2 ends later than 3, so a window past it never sees index 0 or 1.
		expect(visibleItems(row, 15, 25, 1)).toEqual([2]);
	});

	it('reads the window in pixels, so the same band at twice the zoom is half the time', () => {
		expect(visibleItems(row, 9, 13, 2)).toEqual([2, 3]);
	});

	it('returns one shared empty array when nothing overlaps', () => {
		expect(visibleItems(row, 21, 30, 1)).toHaveLength(0);
		expect(visibleItems(row, 21, 30, 1)).toBe(visibleItems(row, 40, 50, 1));
	});
});

describe('sameItems', () => {
	it('compares contents, so an unchanged window can keep the previous array', () => {
		expect(sameItems([1, 2], [1, 2])).toBe(true);
		expect(sameItems([1, 2], [1, 3])).toBe(false);
		expect(sameItems([1, 2], [1])).toBe(false);
	});
});
