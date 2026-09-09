import { describe, expect, it } from 'vitest';

import type { RowWindow } from './timeline_window';
import { sameRowWindow, trackBand } from './timeline_window';

const BASE: RowWindow = { first: 3, last: 8, topSpacer: 300, bottomSpacer: 100, left: 400, right: 2200 };

describe('trackBand', () => {
	it('takes the sticky label off the right edge, because it occludes the front of every track', () => {
		// left is scrollLeft - 600; right is scrollLeft + the unobscured width + 600.
		expect(trackBand(1000, 800, 200)).toEqual({ left: 400, right: 2200 });
	});
});

describe('sameRowWindow', () => {
	it('compares every field, so a pan of one pixel is a different window', () => {
		expect(sameRowWindow(BASE, { ...BASE })).toBe(true);
		for (const field of ['first', 'last', 'topSpacer', 'bottomSpacer', 'left', 'right'] as const) {
			expect(sameRowWindow(BASE, { ...BASE, [field]: BASE[field] + 1 })).toBe(false);
		}
	});
});
