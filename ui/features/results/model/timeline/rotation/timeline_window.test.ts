import { describe, expect, it } from 'vitest';

import { rowOffsets, rowWindow, sameRowWindow } from './timeline_window';

const ORDER = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'];
const offsets = rowOffsets(ORDER, () => 100);

const frame = (over: Partial<Parameters<typeof rowWindow>[0]> = {}) =>
	rowWindow({ offsets, contentTop: 0, viewTop: 500, viewBottom: 600, clientWidth: 800, labelWidth: 200, scrollLeft: 1000, ...over });

describe('rowOffsets', () => {
	it('is the prefix sum of the ordered heights, one entry longer than the order', () => {
		const heights: Record<string, number> = { a: 10, b: 20, c: 30 };
		expect([...rowOffsets(['a', 'b', 'c'], key => heights[key])]).toEqual([0, 10, 30, 60]);
	});
});

describe('rowWindow', () => {
	it('mounts the rows around the scrollport plus the vertical padding, and spaces out the rest', () => {
		// 500..600 of a 1000px list, padded by 200 either way, is rows 3..8 — offsets 300..900.
		expect(frame()).toMatchObject({ first: 3, last: 8, topSpacer: 300, bottomSpacer: 100 });
	});

	it('takes the sticky label off the right edge, because it occludes the front of every track', () => {
		// left is scrollLeft - 600; right is scrollLeft + the unobscured width + 600.
		expect(frame()).toMatchObject({ left: 400, right: 2200 });
	});

	it('clamps to the list at both ends', () => {
		expect(frame({ viewTop: 0, viewBottom: 100 })).toMatchObject({ first: 0, topSpacer: 0 });
		expect(frame({ viewTop: 900, viewBottom: 1000 })).toMatchObject({ last: 9, bottomSpacer: 0 });
	});

	it('offsets the rows by where the content sits in the scrollport', () => {
		expect(frame({ contentTop: 400 })).toMatchObject({ first: 0, last: 4 });
	});

	it('reports nothing measurable rather than emptying the list', () => {
		expect(frame({ clientWidth: 0 })).toBeNull();
		expect(frame({ viewTop: 600, viewBottom: 600 })).toBeNull();
	});

	it('mounts no rows and no spacers for an empty order', () => {
		expect(frame({ offsets: rowOffsets([], () => 0) })).toMatchObject({ first: 0, last: -1, topSpacer: 0, bottomSpacer: 0 });
	});
});

describe('sameRowWindow', () => {
	it('compares every field, so a pan of one pixel is a different window', () => {
		expect(sameRowWindow(frame(), frame())).toBe(true);
		expect(sameRowWindow(frame(), frame({ scrollLeft: 1001 }))).toBe(false);
		expect(sameRowWindow(frame(), frame({ viewTop: 300, viewBottom: 400 }))).toBe(false);
		expect(sameRowWindow(null, frame())).toBe(false);
		expect(sameRowWindow(null, null)).toBe(true);
	});
});
