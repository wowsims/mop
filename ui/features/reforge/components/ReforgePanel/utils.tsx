import type { StatTooltipContent } from '@features/reforge/model/reforge_optimizer';
import { Stat } from '@generated/proto/common';
import type { ReactNode } from 'react';

/** The stats the optimizer offers a cap for. */
export const INCLUDED_STATS = [
	Stat.StatHitRating,
	Stat.StatCritRating,
	Stat.StatHasteRating,
	Stat.StatExpertiseRating,
	Stat.StatMasteryRating,
	Stat.StatDodgeRating,
	Stat.StatParryRating,
];

const DEFAULT_STAT_TOOLTIPS: Partial<Record<Stat, ReactNode>> = {
	[Stat.StatMasteryRating]: (
		<>
			Total <strong>percentage</strong>
		</>
	),
	[Stat.StatHasteRating]: (
		<>
			Final percentage value <strong>including</strong> all buffs/gear.
		</>
	),
};

/** The one place a spec's opaque tooltip entry becomes a node — see `StatTooltipContent`. */
export const statTooltipNode = (make: (() => unknown) | undefined): ReactNode => make?.() as ReactNode;

/** The panel's own entries, overridden per stat by the spec's. Evaluated once per popover open, which is the lifetime tippy's lazy `content` function had. */
export const buildStatTooltips = (override: StatTooltipContent | undefined): Partial<Record<Stat, ReactNode>> => {
	const tooltips: Partial<Record<Stat, ReactNode>> = { ...DEFAULT_STAT_TOOLTIPS };
	for (const [stat, make] of Object.entries(override ?? {})) {
		const content = statTooltipNode(make);
		if (content !== undefined) tooltips[Number(stat) as Stat] = content;
	}
	return tooltips;
};
