import { describe, expect, it } from 'vitest';

import { enemyFormation } from './formation';

const indices = (count: number) => enemyFormation(count).map(card => card.index);

describe('enemyFormation', () => {
	it('grows outwards from enemy 0, alternating sides', () => {
		expect(indices(1)).toEqual([0]);
		expect(indices(3)).toEqual([2, 0, 1]);
		expect(indices(5)).toEqual([4, 2, 0, 1, 3]);
		expect(indices(7)).toEqual([6, 4, 2, 0, 1, 3, 5]);
	});

	it('shares the centre between 0 and 1 when the count is even', () => {
		expect(indices(2)).toEqual([0, 1]);
		expect(indices(4)).toEqual([2, 0, 1, 3]);
		expect(indices(6)).toEqual([4, 2, 0, 1, 3, 5]);
		expect(indices(8)).toEqual([6, 4, 2, 0, 1, 3, 5, 7]);
	});

	it('centres a lone card at full size', () => {
		expect(enemyFormation(1)).toEqual([{ index: 0, xPct: 50, widthPct: 55, scale: 1 }]);
	});

	it('steps the scale down one ring at a time out from the centre', () => {
		expect(enemyFormation(5).map(card => card.scale)).toEqual([0.5, 0.75, 1, 0.75, 0.5]);
	});

	it('pushes the back rank further away once the formation is six deep', () => {
		expect(enemyFormation(4).map(card => card.scale)).toEqual([0.5, 1, 1, 0.5]);
		expect(enemyFormation(8).map(card => card.scale)).toEqual([0.25, 0.5, 0.75, 1, 1, 0.75, 0.5, 0.25]);
	});

	it('widens the spread and narrows the cards as the count grows', () => {
		expect(enemyFormation(2).map(card => card.xPct)).toEqual([25, 75]);
		expect(enemyFormation(3).map(card => card.xPct)).toEqual([15, 50, 85]);
		expect(enemyFormation(5).map(card => card.xPct)).toEqual([10, 30, 50, 70, 90]);
		expect([1, 2, 4, 6, 8].map(count => enemyFormation(count)[0].widthPct)).toEqual([55, 40, 30, 26, 22]);
	});
});
