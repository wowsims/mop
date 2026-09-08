// How far outside the scrollport a row or an item is still worth mounting.
const HORIZONTAL_PADDING_PX = 600;
const VERTICAL_PADDING_PX = 200;

export interface RowWindow {
	first: number;
	last: number;
	topSpacer: number;
	bottomSpacer: number;
	left: number;
	right: number;
}

export interface RowWindowFrame {
	// Prefix sums of the ordered row heights, so `offsets[i]` is the top of row `i` and the last
	// entry is the whole list's height. `rowOffsets` builds it.
	offsets: Float64Array;
	// The content box's top edge, in client coordinates.
	contentTop: number;
	// The vertical scrollport's edges, in client coordinates. A non-`visible` overflow on either
	// axis makes an element a scrollport for both, so the first ancestor that clips vertically is
	// the one the rows are windowed against; the timeline's own scroller carries only the
	// horizontal axis.
	viewTop: number;
	viewBottom: number;
	clientWidth: number;
	labelWidth: number;
	scrollLeft: number;
}

export const rowOffsets = (order: ReadonlyArray<string>, heightOf: (key: string) => number): Float64Array => {
	const offsets = new Float64Array(order.length + 1);
	for (let i = 0; i < order.length; i++) offsets[i + 1] = offsets[i] + heightOf(order[i]);
	return offsets;
};

const indexAt = (offsets: Float64Array, count: number, y: number): number => {
	let lo = 0;
	let hi = count - 1;
	while (lo < hi) {
		const mid = (lo + hi + 1) >> 1;
		if (offsets[mid] <= y) lo = mid;
		else hi = mid - 1;
	}
	return lo;
};

export const EMPTY_ROW_WINDOW: RowWindow = { first: 0, last: -1, topSpacer: 0, bottomSpacer: 0, left: 0, right: 0 };

/**
 * Which rows are close enough to the scrollport to be worth mounting, how tall the spacers above and
 * below them have to be for the outer scrollport to keep the whole list's height, and the horizontal
 * band the tracks have to cover.
 *
 * Null for a frame that cannot be measured — a zero-width scroller, a collapsed viewport — which
 * tells the caller to leave the previous window in place rather than to empty the list.
 */
export const rowWindow = ({ offsets, contentTop, viewTop, viewBottom, clientWidth, labelWidth, scrollLeft }: RowWindowFrame): RowWindow | null => {
	const count = offsets.length - 1;
	if (count === 0) return EMPTY_ROW_WINDOW;
	if (!clientWidth || viewBottom <= viewTop) return null;

	const total = offsets[count];
	const first = indexAt(offsets, count, Math.max(0, viewTop - contentTop - VERTICAL_PADDING_PX));
	const last = indexAt(offsets, count, Math.min(total, viewBottom - contentTop + VERTICAL_PADDING_PX));

	return {
		first,
		last,
		topSpacer: offsets[first],
		bottomSpacer: total - offsets[last + 1],
		left: scrollLeft - HORIZONTAL_PADDING_PX,
		// The sticky label occludes the first labelWidth of every track, so the unobscured track
		// range is [scrollLeft, scrollLeft + clientWidth - labelWidth].
		right: scrollLeft + clientWidth - labelWidth + HORIZONTAL_PADDING_PX,
	};
};

export const sameRowWindow = (a: RowWindow | null, b: RowWindow | null): boolean =>
	a === b ||
	(!!a &&
		!!b &&
		a.first === b.first &&
		a.last === b.last &&
		a.topSpacer === b.topSpacer &&
		a.bottomSpacer === b.bottomSpacer &&
		a.left === b.left &&
		a.right === b.right);
