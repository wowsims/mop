// How far outside the scrollport a row or an item is still worth mounting.
const HORIZONTAL_PADDING_PX = 600;
export const VERTICAL_PADDING_PX = 200;

export interface RowWindow {
	first: number;
	last: number;
	topSpacer: number;
	bottomSpacer: number;
	left: number;
	right: number;
}

export type TrackBand = Pick<RowWindow, 'left' | 'right'>;

export const EMPTY_ROW_WINDOW: RowWindow = { first: 0, last: -1, topSpacer: 0, bottomSpacer: 0, left: 0, right: 0 };

/**
 * The horizontal band every mounted track has to cover, in pixels at the current zoom.
 *
 * The sticky label occludes the first `labelWidth` of every track, so the unobscured track range is
 * [scrollLeft, scrollLeft + clientWidth - labelWidth].
 */
export const trackBand = (scrollLeft: number, clientWidth: number, labelWidth: number): TrackBand => ({
	left: scrollLeft - HORIZONTAL_PADDING_PX,
	right: scrollLeft + clientWidth - labelWidth + HORIZONTAL_PADDING_PX,
});

export const sameRowWindow = (a: RowWindow, b: RowWindow): boolean =>
	a === b ||
	(a.first === b.first && a.last === b.last && a.topSpacer === b.topSpacer && a.bottomSpacer === b.bottomSpacer && a.left === b.left && a.right === b.right);
