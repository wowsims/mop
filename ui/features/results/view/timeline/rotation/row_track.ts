import type { ContentRow } from './model';

export const NO_ITEMS: ReadonlyArray<number> = [];

/**
 * The indexes of a row's items that overlap `[left, right]` pixels at `pps`, ascending.
 *
 * Items are ordered by `start`, so an upper bound finds the last one that begins before the right
 * edge; from there the walk back is bounded by `maxRightUpTo`, the running maximum of every earlier
 * item's end, which is what stops a long aura earlier in the row from forcing a scan of the whole
 * array on every frame.
 */
export const visibleItems = (row: ContentRow, left: number, right: number, pps: number): ReadonlyArray<number> => {
	const { items, maxRightUpTo } = row;
	const leftTime = left / pps;
	const rightTime = right / pps;

	let lo = 0;
	let hi = items.length;
	while (lo < hi) {
		const mid = (lo + hi) >> 1;
		if (items[mid].start <= rightTime) lo = mid + 1;
		else hi = mid;
	}

	const found: Array<number> = [];
	for (let i = lo - 1; i >= 0 && maxRightUpTo[i] >= leftTime; i--) {
		if (items[i].end >= leftTime) found.push(i);
	}
	if (found.length === 0) return NO_ITEMS;
	return found.reverse();
};

export const sameItems = (a: ReadonlyArray<number>, b: ReadonlyArray<number>): boolean =>
	a === b || (a.length === b.length && a.every((index, at) => index === b[at]));
