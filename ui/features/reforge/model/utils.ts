import { StatCapType } from '@generated/proto/api';
import { Stat } from '@generated/proto/common';
import * as Mechanics from '@sim/constants/mechanics';
import type { Player } from '@sim/player/player';
import { StatCap, Stats, UnitStat } from '@sim/proto/stats';

/**
 * Trims every breakpoint above its stat's limit. A stat can have multiple configs (e.g. a SoftCap
 * and a Threshold for the same stat), so the limit lands on whichever config actually owns that
 * breakpoint rather than just the first matching stat.
 */
export const applyBreakpointLimits = (softCaps: StatCap[], breakpointLimits: Stats): StatCap[] => {
	const limited = StatCap.cloneSoftCaps(softCaps);
	for (const [unitStat, limit] of breakpointLimits.asUnitStatArray()) {
		if (!limit) continue;
		for (const config of limited) {
			if (!config.unitStat.equals(unitStat) || !config.breakpoints.some(breakpoint => breakpoint == limit)) continue;
			config.breakpoints = config.breakpoints.filter(breakpoint => breakpoint <= limit);
			if (config.capType === StatCapType.TypeSoftCap) {
				config.postCapEPs = config.postCapEPs.slice(0, config.breakpoints.length);
			}
		}
	}
	return limited;
};

/** Drops the hard cap of every soft-capped stat, so the breakpoints are the only cap the solve sees. */
export const clearSoftCappedStats = (statCaps: Stats, softCaps: StatCap[]): Stats =>
	softCaps.reduce((caps, { unitStat }) => caps.withUnitStat(unitStat, 0), statCaps);

/** Rating to the percentage the cap inputs display. Mastery shows points, which scale off the spec's per-point modifier. */
export const toVisualUnitStatPercentage = (player: Player<any>, statValue: number, unitStat: UnitStat): number => {
	const percentOrPointsValue = unitStat.convertDefaultUnitsToPercent(statValue)!;
	if (!unitStat.equalsStat(Stat.StatMasteryRating)) return percentOrPointsValue;

	const baseMastery = player.getBaseMastery() * Mechanics.MASTERY_RATING_PER_MASTERY_POINT;
	return statValue - baseMastery <= 0 ? 0 : percentOrPointsValue * player.getMasteryPerPointModifier();
};

/** The inverse of `toVisualUnitStatPercentage`, for what the user types back in. */
export const toDefaultUnitStatValue = (player: Player<any>, value: number, unitStat: UnitStat): number => {
	const statValue = unitStat.convertPercentToDefaultUnits(value)!;
	return unitStat.equalsStat(Stat.StatMasteryRating) ? statValue / player.getMasteryPerPointModifier() : statValue;
};

/** A configured breakpoint as the tooltips and limit selects show it. Unlike the cap inputs, base mastery is not subtracted. */
export const breakpointValueToDisplayPercentage = (player: Player<any>, value: number, unitStat: UnitStat): string =>
	unitStat.equalsStat(Stat.StatMasteryRating)
		? ((value / Mechanics.MASTERY_RATING_PER_MASTERY_POINT) * player.getMasteryPerPointModifier()).toFixed(2)
		: unitStat.convertDefaultUnitsToPercent(value)!.toFixed(2);
