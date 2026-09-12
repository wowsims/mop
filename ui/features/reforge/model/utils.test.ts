import { StatCapType } from '@generated/proto/api';
import { Stat } from '@generated/proto/common';
import type { Player } from '@sim/player/player';
import { StatCap, Stats, UnitStat } from '@sim/proto/stats';
import { describe, expect, it } from 'vitest';

import { applyBreakpointLimits, breakpointValueToDisplayPercentage, clearSoftCappedStats, toDefaultUnitStatValue, toVisualUnitStatPercentage } from './utils';

const MASTERY = UnitStat.fromStat(Stat.StatMasteryRating);
const CRIT = UnitStat.fromStat(Stat.StatCritRating);

// 8 mastery points of base (4800 rating) and 1.25% per point, so 6000 rating = 10 points = 12.5%.
const player = { getBaseMastery: () => 8, getMasteryPerPointModifier: () => 1.25 } as unknown as Player<any>;

const softCap = (unitStat: UnitStat, breakpoints: number[], postCapEPs: number[]) => new StatCap(unitStat, breakpoints, StatCapType.TypeSoftCap, postCapEPs);
const threshold = (unitStat: UnitStat, breakpoints: number[], postCapEPs: number[]) =>
	new StatCap(unitStat, breakpoints, StatCapType.TypeThreshold, postCapEPs);

describe('applyBreakpointLimits', () => {
	it('keeps every breakpoint up to and including the limit', () => {
		const [limited] = applyBreakpointLimits([softCap(MASTERY, [1000, 2000, 3000], [3, 2, 1])], new Stats().withUnitStat(MASTERY, 2000));

		expect(limited.breakpoints).toEqual([1000, 2000]);
		expect(limited.postCapEPs).toEqual([3, 2]);
	});

	it('limits the config that owns the breakpoint, not the first config for that stat', () => {
		const configs = [softCap(MASTERY, [1000, 2000, 3000], [3, 2, 1]), threshold(MASTERY, [1500], [9])];

		const [limitedSoftCap, limitedThreshold] = applyBreakpointLimits(configs, new Stats().withUnitStat(MASTERY, 1500));

		expect(limitedSoftCap.breakpoints).toEqual([1000, 2000, 3000]);
		expect(limitedSoftCap.postCapEPs).toEqual([3, 2, 1]);
		expect(limitedThreshold.breakpoints).toEqual([1500]);
	});

	it('trims a soft cap’s post-cap EPs with its breakpoints, but leaves a threshold’s alone', () => {
		const limits = new Stats().withUnitStat(MASTERY, 1000);

		expect(applyBreakpointLimits([softCap(MASTERY, [1000, 2000], [2, 1])], limits)[0].postCapEPs).toEqual([2]);
		// A threshold's post-cap EPs are not per breakpoint, so trimming them would drop the wrong entries.
		expect(applyBreakpointLimits([threshold(MASTERY, [1000, 2000], [9, 8])], limits)[0].postCapEPs).toEqual([9, 8]);
	});

	it('ignores a limit no config declares as a breakpoint, and an unset limit', () => {
		const configs = [softCap(MASTERY, [1000, 2000], [2, 1])];

		expect(applyBreakpointLimits(configs, new Stats().withUnitStat(MASTERY, 1234))[0].breakpoints).toEqual([1000, 2000]);
		expect(applyBreakpointLimits(configs, new Stats())[0].breakpoints).toEqual([1000, 2000]);
	});

	it('clones rather than trimming the configs it was given', () => {
		const original = softCap(MASTERY, [1000, 2000, 3000], [3, 2, 1]);

		const [limited] = applyBreakpointLimits([original], new Stats().withUnitStat(MASTERY, 1000));

		expect(limited).not.toBe(original);
		expect(original.breakpoints).toEqual([1000, 2000, 3000]);
		expect(original.postCapEPs).toEqual([3, 2, 1]);
	});
});

describe('clearSoftCappedStats', () => {
	it('zeroes the hard cap of every soft-capped stat and leaves the rest', () => {
		const statCaps = new Stats().withUnitStat(MASTERY, 5000).withUnitStat(CRIT, 3000);

		const cleared = clearSoftCappedStats(statCaps, [softCap(MASTERY, [1000], [1])]);

		expect(cleared.getUnitStat(MASTERY)).toBe(0);
		expect(cleared.getUnitStat(CRIT)).toBe(3000);
	});

	it('returns the caps untouched when nothing is soft capped', () => {
		const statCaps = new Stats().withUnitStat(CRIT, 3000);

		expect(clearSoftCappedStats(statCaps, []).getUnitStat(CRIT)).toBe(3000);
	});
});

describe('stat cap unit conversions', () => {
	it('scales mastery rating by the per-point modifier', () => {
		expect(toVisualUnitStatPercentage(player, 6000, MASTERY)).toBe(12.5);
	});

	it('shows nothing for mastery at or below the base', () => {
		expect(toVisualUnitStatPercentage(player, 4800, MASTERY)).toBe(0);
		expect(toVisualUnitStatPercentage(player, 3000, MASTERY)).toBe(0);
	});

	it('leaves other stats on the plain rating scale', () => {
		expect(toVisualUnitStatPercentage(player, 3000, CRIT)).toBe(5);
	});

	it('round-trips back to rating', () => {
		expect(toDefaultUnitStatValue(player, 12.5, MASTERY)).toBe(6000);
		expect(toDefaultUnitStatValue(player, 5, CRIT)).toBe(3000);
	});

	it('shows a breakpoint without subtracting base mastery', () => {
		expect(breakpointValueToDisplayPercentage(player, 6000, MASTERY)).toBe('12.50');
		expect(breakpointValueToDisplayPercentage(player, 3000, MASTERY)).toBe('6.25');
		expect(breakpointValueToDisplayPercentage(player, 3000, CRIT)).toBe('5.00');
	});
});
