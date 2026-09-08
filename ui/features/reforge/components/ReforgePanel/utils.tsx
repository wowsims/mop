import type { StatTooltipContent } from '@features/reforge/model/reforge_optimizer';
import { Stat } from '@generated/proto/common';
import { adoptNode } from '@ui-kit/utils/dom';
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

/** `StatTooltipContent` is the frozen spec surface and yields `Element | string`, so a spec's own entry is adopted rather than re-authored. */
export const StatTooltip = ({ content }: { content: Element | string }) => (typeof content === 'string' ? <>{content}</> : <span ref={adoptNode(content)} />);

/** The panel's own entries, overridden per stat by the spec's. Evaluated once per popover open, which is the lifetime tippy's lazy `content` function had. */
export const buildStatTooltips = (override: StatTooltipContent | undefined): Partial<Record<Stat, ReactNode>> => {
	const tooltips: Partial<Record<Stat, ReactNode>> = { ...DEFAULT_STAT_TOOLTIPS };
	for (const [stat, make] of Object.entries(override ?? {})) {
		const content = make?.();
		if (content !== undefined) tooltips[Number(stat) as Stat] = <StatTooltip content={content} />;
	}
	return tooltips;
};
