import { cssVars } from '@ui-kit/utils/css';
import type { CSSProperties } from 'react';

import type { Row } from '../../../view/timeline/rotation/model';
import { sameItems, visibleItems } from '../../../view/timeline/rotation/row_track';
import type { RowWindow } from '../../../view/timeline/rotation/timeline_window';
import { EMPTY_ROW_WINDOW, sameRowWindow } from '../../../view/timeline/rotation/timeline_window';

/** One rotation frame: which rows are mounted, and which of each row's items are inside the track window. */
export interface RotationFrame {
	// The order the window's indexes point into. A frame measured against a different one is stale,
	// which is what `nextFrame` is asked to fix in the same render rather than a frame later.
	order: ReadonlyArray<string>;
	window: RowWindow;
	items: ReadonlyMap<string, ReadonlyArray<number>>;
}

export const EMPTY_FRAME: RotationFrame = { order: [], window: EMPTY_ROW_WINDOW, items: new Map() };

const sameFrame = (a: RotationFrame, b: RotationFrame): boolean => {
	if (a.order !== b.order || !sameRowWindow(a.window, b.window) || a.items.size !== b.items.size) return false;
	for (const [key, indexes] of a.items) {
		// Identity, not contents: `nextFrame` hands back the previous array whenever the contents match.
		if (b.items.get(key) !== indexes) return false;
	}
	return true;
};

/**
 * The frame the view should render, or the previous one unchanged. Returning `prev` is what makes a
 * scroll that moves nothing — the common case, since the page owns vertical scrolling and the frame
 * runs far more often than the window moves — cost one binary search per mounted row and no render.
 */
export const nextFrame = (prev: RotationFrame, window: RowWindow, pps: number, order: ReadonlyArray<string>, rowFor: (key: string) => Row): RotationFrame => {
	const items = new Map<string, ReadonlyArray<number>>();
	for (let index = window.first; index <= window.last; index++) {
		const key = order[index];
		const row = rowFor(key);
		if (row.kind === 'header' || row.kind === 'separator') continue;
		const found = visibleItems(row, window.left, window.right, pps);
		const before = prev.items.get(key);
		items.set(key, before && sameItems(before, found) ? before : found);
	}
	const next = { order, window, items };
	return sameFrame(prev, next) ? prev : next;
};

/** A row is exactly as tall as the window measured it, which is what makes the spacer arithmetic hold. */
export const rowStyle = (row: Row): CSSProperties => cssVars({ '--row-h': String(row.height) });

/** Where a bar starts and how long it runs, in seconds; the stylesheet turns both into pixels at the current zoom. */
export const spanStyle = (start: number, duration: number): CSSProperties => cssVars({ '--t': String(start), '--dur': String(duration) });
