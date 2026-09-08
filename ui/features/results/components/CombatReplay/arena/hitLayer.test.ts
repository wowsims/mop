import { beforeEach, describe, expect, it } from 'vitest';

import type { ReplayHit } from '../../../model/replay';
import type { HitNodeCache } from './hitLayer';
import { paintHitLayer } from './hitLayer';

const hit = (time: number, overrides: Partial<ReplayHit> = {}): ReplayHit => ({ time, x: 10, y: 20, dmg: 500, isCrit: false, ...overrides });

let container: HTMLElement;
let cache: HitNodeCache;

const roots = () => [...container.children] as Array<HTMLElement>;

beforeEach(() => {
	container = document.createElement('div');
	cache = new Map();
});

describe('paintHitLayer', () => {
	it('builds one effect per hit, placed where it landed', () => {
		const first = hit(1, { x: 30, y: 40 });
		paintHitLayer(container, cache, [first, hit(2)], 2);

		expect(roots()).toHaveLength(2);
		expect(roots()[0].style.left).toBe('30%');
		expect(roots()[0].style.top).toBe('40%');
	});

	it('gives a crit a second ring and a hit only one', () => {
		paintHitLayer(container, cache, [hit(1), hit(2, { isCrit: true })], 2);

		expect(roots()[0].querySelectorAll('.cr-hit-ring')).toHaveLength(1);
		expect(roots()[1].querySelectorAll('.cr-hit-ring')).toHaveLength(2);
		expect(roots()[1].querySelector('.cr-dmg-num')!.className).toBe('cr-dmg-num cr-dmg-crit');
	});

	it('leaves out the number when the hit dealt nothing', () => {
		paintHitLayer(container, cache, [hit(1, { dmg: null })], 1);
		expect(roots()[0].querySelector('.cr-dmg-num')).toBeNull();
	});

	// The point of the pool: a hit that is still on screen keeps its node, so a frame is style writes
	// rather than a rebuilt subtree.
	it('keeps the node of a hit that is still live and drops the one that is not', () => {
		const first = hit(1);
		const second = hit(2);
		paintHitLayer(container, cache, [first, second], 2);
		const kept = roots()[1];

		paintHitLayer(container, cache, [second], 2.5);
		expect(roots()).toEqual([kept]);
		expect(cache.size).toBe(1);
	});

	it('grows and fades an effect as it ages', () => {
		const only = hit(1);
		paintHitLayer(container, cache, [only], 1);
		const flash = roots()[0].querySelector<HTMLElement>('.cr-hit-flash')!;
		expect(flash.style.width).toBe('14px');
		expect(flash.style.opacity).toBe('0.85');

		paintHitLayer(container, cache, [only], 1.3);
		expect(parseFloat(flash.style.width)).toBeGreaterThan(14);
		expect(parseFloat(flash.style.opacity)).toBeLessThan(0.85);
	});

	it('puts an older hit back in front when the playhead moves backwards', () => {
		const first = hit(1);
		const second = hit(2);
		paintHitLayer(container, cache, [second], 2);
		paintHitLayer(container, cache, [first, second], 2);

		expect(roots()).toHaveLength(2);
		expect(roots()[0].style.left).toBe(`${first.x}%`);
		expect(cache.get(first)!.root).toBe(roots()[0]);
	});

	it('empties the layer when nothing is live', () => {
		paintHitLayer(container, cache, [hit(1)], 1);
		paintHitLayer(container, cache, [], 5);
		expect(roots()).toEqual([]);
		expect(cache.size).toBe(0);
	});
});
