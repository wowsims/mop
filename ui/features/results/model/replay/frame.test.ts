import type { AuraStacksLog } from '@sim/proto/combat_log';
import { describe, expect, it } from 'vitest';

import {
	actionIndexAt,
	activeAuras,
	activeHits,
	auraFrame,
	castBarFrame,
	healthFractionAt,
	hitDamageLabel,
	hitFrame,
	isActionRecent,
	replayTimeLabel,
	resourceValueAt,
	scrubberTime,
	scrubberValue,
	stacksAt,
	tickerCasts,
	tickerDamageLabel,
	tickerOpacity,
} from './frame';
import type { ReplayAction, ReplayAura, ReplayEnemy, ReplayHit } from './types';

const action = (time: number, name: string): ReplayAction => ({ time, name, actionId: null, dmg: null, isCrit: false });

const aura = (gainedAt: number, fadedAt: number, name: string, stacksChange: Array<{ timestamp: number; newStacks: number }> = []): ReplayAura => ({
	gainedAt,
	fadedAt,
	name,
	actionId: null,
	stacksChange: stacksChange as Array<AuraStacksLog>,
});

const hit = (time: number, dmg: number | null = 100): ReplayHit => ({ time, x: 0, y: 0, dmg, isCrit: false });

const enemy = (hits: Array<ReplayHit>): ReplayEnemy => {
	let running = 0;
	return {
		index: 0,
		name: 'Boss',
		auras: [],
		hits,
		cumulativeDamage: hits.map(entry => (running += entry.dmg ?? 0)),
		totalDamage: hits.reduce((total, entry) => total + (entry.dmg ?? 0), 0),
	};
};

describe('actionIndexAt', () => {
	const actions = [action(0, 'A'), action(2, 'B'), action(5, 'C')];

	it('is the last cast at or before the playhead', () => {
		expect(actionIndexAt(actions, 1.9)).toBe(0);
		expect(actionIndexAt(actions, 2)).toBe(1);
		expect(actionIndexAt(actions, 99)).toBe(2);
	});

	it('reports nothing cast yet before the first', () => {
		expect(actionIndexAt(actions, -1)).toBe(-1);
		expect(actionIndexAt([], 10)).toBe(-1);
	});
});

describe('tickerCasts', () => {
	const actions = [action(0, 'A'), action(1, 'B'), action(2, 'C'), action(3, 'D')];

	it('keeps only the tail up to the playhead', () => {
		expect(tickerCasts(actions, 2).map(cast => cast.name)).toEqual(['A', 'B', 'C']);
		expect(tickerCasts(actions, 3).map(cast => cast.name)).toEqual(['A', 'B', 'C', 'D']);
	});

	it('holds no more than the strip has room for', () => {
		const many = Array.from({ length: 30 }, (_, index) => action(index, `A${index}`));
		expect(tickerCasts(many, 29)).toHaveLength(10);
		expect(tickerCasts(many, 29)[0].name).toBe('A20');
	});

	it('is empty before the first cast', () => {
		expect(tickerCasts(actions, -0.5)).toEqual([]);
	});

	it('fades everything but the newest', () => {
		expect(tickerOpacity(2, 3)).toBe(1);
		expect(tickerOpacity(0, 3)).toBe(0.25);
		expect(tickerOpacity(0, 1)).toBe(1);
	});
});

describe('castBarFrame', () => {
	it('is idle before the first cast', () => {
		expect(castBarFrame([action(4, 'Bolt')], 30, 1)).toEqual({ width: '0%', label: '', remaining: '' });
	});

	it('is idle for a gap that is filler rather than a cast', () => {
		const actions = [action(0, 'Bolt'), action(1, 'Shot')];
		expect(castBarFrame(actions, 30, 0.5).label).toBe('');
	});

	it('is idle for a gap too long to be one cast', () => {
		const actions = [action(0, 'Bolt'), action(11, 'Shot')];
		expect(castBarFrame(actions, 30, 5).label).toBe('');
	});

	it('fills over the gap to the next cast', () => {
		const actions = [action(0, 'Bolt'), action(4, 'Shot')];
		expect(castBarFrame(actions, 30, 1)).toEqual({ width: '25%', label: 'Bolt', remaining: '3.0s' });
		expect(castBarFrame(actions, 30, 3.5)).toEqual({ width: '87.5%', label: 'Bolt', remaining: '0.5s' });
	});

	it('runs the last cast out to the end of the fight', () => {
		expect(castBarFrame([action(0, 'Bolt')], 4, 2)).toEqual({ width: '50%', label: 'Bolt', remaining: '2.0s' });
	});
});

describe('isActionRecent', () => {
	const actions = [action(0, 'Bolt'), action(0.2, 'Shot'), action(0.4, 'Bolt')];

	it('holds for the window after the cast', () => {
		expect(isActionRecent(actions, 'Bolt', 0.9)).toBe(true);
		expect(isActionRecent(actions, 'Bolt', 1.1)).toBe(false);
	});

	it('does not look back past the handful of casts before the playhead', () => {
		const many = Array.from({ length: 10 }, (_, index) => action(index * 0.01, index === 0 ? 'Bolt' : 'Filler'));
		expect(isActionRecent(many, 'Bolt', 0.09)).toBe(false);
		expect(isActionRecent(many, 'Filler', 0.09)).toBe(true);
	});

	it('is false with nothing cast yet', () => {
		expect(isActionRecent(actions, 'Bolt', -1)).toBe(false);
	});
});

describe('activeAuras', () => {
	const auras = [aura(0, 30, 'Long'), aura(1, 4, 'Short'), aura(20, 25, 'Later')];

	it('takes what is up, soonest to expire first', () => {
		expect(activeAuras(auras, 2).map(entry => entry.name)).toEqual(['Short', 'Long']);
	});

	it('counts both ends of the span as up', () => {
		expect(activeAuras(auras, 1).map(entry => entry.name)).toEqual(['Short', 'Long']);
		expect(activeAuras(auras, 4).map(entry => entry.name)).toEqual(['Short', 'Long']);
		expect(activeAuras(auras, 4.01).map(entry => entry.name)).toEqual(['Long']);
	});
});

describe('stacksAt', () => {
	const changes = [
		{ timestamp: 1, newStacks: 2 },
		{ timestamp: 3, newStacks: 5 },
	];

	it('takes the change at or before the playhead', () => {
		expect(stacksAt(changes as Array<AuraStacksLog>, 0.9)).toBe(0);
		expect(stacksAt(changes as Array<AuraStacksLog>, 1)).toBe(2);
		expect(stacksAt(changes as Array<AuraStacksLog>, 2.9)).toBe(2);
		expect(stacksAt(changes as Array<AuraStacksLog>, 3)).toBe(5);
	});
});

describe('auraFrame', () => {
	it('counts down to a tenth under ten seconds and to a whole second above', () => {
		expect(auraFrame(aura(0, 5, 'Buff'), 1.25).remaining).toBe('3.8');
		expect(auraFrame(aura(0, 30, 'Buff'), 1).remaining).toBe('29');
	});

	it('shows a stack count only once there is more than one', () => {
		const stacked = aura(0, 30, 'Buff', [
			{ timestamp: 0, newStacks: 1 },
			{ timestamp: 5, newStacks: 3 },
		]);
		expect(auraFrame(stacked, 1).stacks).toBe('');
		expect(auraFrame(stacked, 6).stacks).toBe('3');
	});

	it('is fresh for the window after it lands', () => {
		expect(auraFrame(aura(10, 30, 'Buff'), 10.5).fresh).toBe(true);
		expect(auraFrame(aura(10, 30, 'Buff'), 11).fresh).toBe(false);
	});
});

describe('resourceValueAt', () => {
	const samples = [
		{ time: 1, value: 80 },
		{ time: 4, value: 20 },
	];

	it('holds the last logged value', () => {
		expect(resourceValueAt(samples, 0.5)).toBe(0);
		expect(resourceValueAt(samples, 1)).toBe(80);
		expect(resourceValueAt(samples, 3.9)).toBe(80);
		expect(resourceValueAt(samples, 10)).toBe(20);
	});
});

describe('healthFractionAt', () => {
	const boss = enemy([hit(1, 25), hit(2, 25), hit(3, 50)]);

	it('drains as the damage it will ever take lands', () => {
		expect(healthFractionAt(boss, 0)).toBe(1);
		expect(healthFractionAt(boss, 1)).toBe(0.75);
		expect(healthFractionAt(boss, 2.9)).toBe(0.5);
		expect(healthFractionAt(boss, 3)).toBe(0);
	});

	it('leaves an enemy that takes nothing at full health', () => {
		expect(healthFractionAt(enemy([]), 10)).toBe(1);
		expect(healthFractionAt(enemy([hit(1, null)]), 10)).toBe(1);
	});
});

describe('activeHits', () => {
	const boss = enemy([hit(1), hit(1.5), hit(3)]);

	it('takes the hits inside the window behind the playhead', () => {
		expect(activeHits(boss, 2).map(entry => entry.time)).toEqual([1, 1.5]);
		expect(activeHits(boss, 3).map(entry => entry.time)).toEqual([3]);
	});

	it('drops a hit the moment the window passes it', () => {
		expect(activeHits(boss, 2.5).map(entry => entry.time)).toEqual([1.5]);
		expect(activeHits(boss, 2.65).map(entry => entry.time)).toEqual([]);
	});

	it('shows nothing before the first hit', () => {
		expect(activeHits(boss, 0.5)).toEqual([]);
	});
});

describe('hitFrame', () => {
	it('starts small and opaque', () => {
		const frame = hitFrame(hit(1), 1);
		expect(frame.flashSize).toBe(14);
		expect(frame.ringSize).toBe(24);
		expect(frame.ringOpacity).toBe(0.85);
		expect(frame.floatY).toBe(0);
	});

	it('has expanded and faded by the end of the burst', () => {
		const frame = hitFrame(hit(0), 0.45);
		expect(frame.flashSize).toBe(42);
		expect(frame.ringSize).toBe(96);
		expect(frame.ringOpacity).toBe(0);
		expect(frame.flashOpacity).toBe(0);
	});

	it('gives a crit a fully opaque flash', () => {
		expect(hitFrame({ ...hit(1), isCrit: true }, 1).flashOpacity).toBe(1);
		expect(hitFrame(hit(1), 1).flashOpacity).toBe(0.85);
	});

	it('floats the number up and fades it out over the longer window', () => {
		expect(hitFrame(hit(0), 1.1).floatY).toBe(42);
		expect(hitFrame(hit(0), 1.1).numberOpacity).toBe(0);
		expect(hitFrame(hit(0), 0.55).numberOpacity).toBe(1);
	});
});

describe('labels', () => {
	it('abbreviates a ticker badge at a thousand', () => {
		expect(tickerDamageLabel(999.4)).toBe('999');
		expect(tickerDamageLabel(12345)).toBe('12.3k');
	});

	it('abbreviates a floating number at a thousand and again at a million', () => {
		expect(hitDamageLabel(999)).toBe('999');
		expect(hitDamageLabel(12345)).toBe('12.3K');
		expect(hitDamageLabel(2500000)).toBe('2.50M');
	});

	it('reads the playhead against the fight length', () => {
		expect(replayTimeLabel(0, 125.5)).toBe('0:00.0 / 2:05.5');
		expect(replayTimeLabel(65.25, 125.5)).toBe('1:05.3 / 2:05.5');
	});
});

describe('scrubber', () => {
	it('maps the fight onto a thousand steps, either way', () => {
		expect(scrubberValue(0, 300)).toBe(0);
		expect(scrubberValue(150, 300)).toBe(500);
		expect(scrubberValue(300, 300)).toBe(1000);
		expect(scrubberTime(500, 300)).toBe(150);
	});

	it('does not divide by a fight of no length', () => {
		expect(scrubberValue(0, 0)).toBe(0);
	});
});
