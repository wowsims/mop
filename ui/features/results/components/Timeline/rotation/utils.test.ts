import { describe, expect, it } from 'vitest';

import type { ContentRow, Row, RowItem } from '../../../model/timeline/rotation';
import type { RowWindow } from '../../../model/timeline/rotation/timeline_window';
import { EMPTY_ROW_WINDOW } from '../../../model/timeline/rotation/timeline_window';
import { EMPTY_FRAME, nextFrame } from './utils';

const item = (start: number, end: number) => ({ kind: 'aura', start, end }) as RowItem;

const contentRow = (key: string, items: Array<RowItem>): ContentRow =>
	({
		kind: 'aura',
		key,
		items,
		maxRightUpTo: items.map((_, index) => Math.max(...items.slice(0, index + 1).map(entry => entry.end))),
	}) as ContentRow;

const ROWS: Record<string, Row> = {
	head: { kind: 'header', key: 'head' } as Row,
	a: contentRow('a', [item(0, 1), item(5, 6), item(20, 21)]),
	b: contentRow('b', [item(0, 30)]),
};
const ORDER = ['head', 'a', 'b'];
const rowFor = (key: string) => ROWS[key];

const win = (over: Partial<RowWindow> = {}): RowWindow => ({ first: 0, last: 2, topSpacer: 0, bottomSpacer: 0, left: 0, right: 1000, ...over });

describe('nextFrame', () => {
	it('windows every mounted content row and skips the rows that hold no items', () => {
		const frame = nextFrame(EMPTY_FRAME, win(), 100, ORDER, rowFor);
		expect([...frame.items.keys()]).toEqual(['a', 'b']);
		expect(frame.items.get('a')).toEqual([0, 1]);
	});

	it('hands back the previous frame when nothing moved, so the view does not render', () => {
		const first = nextFrame(EMPTY_FRAME, win(), 100, ORDER, rowFor);
		expect(nextFrame(first, win(), 100, ORDER, rowFor)).toBe(first);
	});

	it('keeps each unchanged row’s array identity across a pan that only moves one row', () => {
		const first = nextFrame(EMPTY_FRAME, win(), 100, ORDER, rowFor);
		// 0..2500px at 100 pps is 0..25s: row a gains its third item, row b still has its only one.
		const second = nextFrame(first, win({ right: 2500 }), 100, ORDER, rowFor);
		expect(second).not.toBe(first);
		expect(second.items.get('a')).toEqual([0, 1, 2]);
		expect(second.items.get('b')).toBe(first.items.get('b'));
	});

	it('always reports the order it was measured against, so a reorder can never be mistaken for a no-op', () => {
		// Hiding the last row of a collapsed pane leaves the window identical and the item map empty;
		// only the order says the frame is stale.
		const first = nextFrame(EMPTY_FRAME, EMPTY_ROW_WINDOW, 100, ORDER, rowFor);
		const second = nextFrame(first, EMPTY_ROW_WINDOW, 100, ['head'], rowFor);
		expect(second).not.toBe(first);
		expect(second.order).toEqual(['head']);
	});

	it('re-windows on a zoom even when the pixel band is the same', () => {
		const first = nextFrame(EMPTY_FRAME, win(), 100, ORDER, rowFor);
		expect(nextFrame(first, win(), 20, ORDER, rowFor).items.get('a')).toEqual([0, 1, 2]);
	});
});
