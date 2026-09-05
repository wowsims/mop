import { ActionId } from '@domain/proto_utils/action_id';
import { masterySpellIDs } from '@domain/proto_utils/names';
import type { StatAttribution, Stats, UnitStat } from '@domain/proto_utils/stats';
import { usePlayer } from '@features/sim_host_context';
import { PseudoStat, Stat } from '@generated/proto/common';
import i18n from '@i18n/config';
import { translateMasterySpellName } from '@i18n/localization';
import { Tooltip } from '@ui-kit/Tooltip';
import clsx from 'clsx';
import { useId } from 'react';

import { BonusStatsLink } from './BonusStatsLink';
import { bonusStatClass, masteryScaling } from './stat_display';
import { TooltipNote } from './TooltipNote';
import { TooltipRow } from './TooltipRow';

export interface StatRowProps {
	unitStat: UnitStat;
	bonusStats: Stats;
	attribution: StatAttribution;
	/** `statDisplayString` with the player and its racial bonuses already bound. */
	show: (deltaStats: Stats, unitStat: UnitStat, includeBase?: boolean) => string;
}

export const StatRow = ({ unitStat, bonusStats, attribution, show }: StatRowProps) => {
	const player = usePlayer();
	const id = useId();
	const isMastery = unitStat.equalsStat(Stat.StatMasteryRating);
	const bonusStatValue = unitStat.hasRootStat() ? bonusStats.getStat(unitStat.getRootStat()) : 0;
	const contextualClass = bonusStatClass(bonusStatValue);
	const { modifiers, customBonus } = masteryScaling(player);

	return (
		<tr className="character-stats-table-row">
			<td className="character-stats-table-label">
				{unitStat.getShortName(player.getClass())}
				{isMastery && <div>{translateMasterySpellName(player.getSpec())}</div>}
			</td>
			<td className="character-stats-table-value">
				<div className="stat-value-link-container">
					<button className={clsx('stat-value-link', contextualClass)} data-tooltip-id={id}>
						{`${show(attribution.final, unitStat, true)} `}
					</button>
					{isMastery &&
						modifiers.map((modifier, index) => (
							<a
								key={index}
								href={ActionId.makeSpellUrl(masterySpellIDs.get(player.getSpec()) || 0)}
								className={clsx('stat-value-link-mastery', contextualClass)}
								target="_blank">
								{`${(attribution.masteryPoints * modifier + customBonus[index]).toFixed(2)}%`}
							</a>
						))}
				</div>
				{unitStat.hasRootStat() && <BonusStatsLink rootStat={unitStat.getRootStat()} />}
				<Tooltip
					id={id}
					content={
						<div>
							<TooltipRow label={i18n.t('sidebar.character_stats.tooltip.base')} value={show(attribution.base, unitStat, true)} />
							<TooltipRow label={i18n.t('sidebar.character_stats.tooltip.gear')} value={show(attribution.gear, unitStat)} />
							<TooltipRow label={i18n.t('sidebar.character_stats.tooltip.talents')} value={show(attribution.talents, unitStat)} />
							<TooltipRow label={i18n.t('sidebar.character_stats.tooltip.buffs')} value={show(attribution.buffs, unitStat)} />
							<TooltipRow label={i18n.t('sidebar.character_stats.tooltip.consumes')} value={show(attribution.consumes, unitStat)} />
							{bonusStatValue !== 0 && <TooltipRow label={i18n.t('sidebar.character_stats.tooltip.bonus')} value={show(bonusStats, unitStat)} />}
							<TooltipRow label={i18n.t('sidebar.character_stats.tooltip.total')} value={show(attribution.final, unitStat, true)} />
							{unitStat.isPseudoStat() && unitStat.getPseudoStat() === PseudoStat.PseudoStatSpellHitPercent && (
								<TooltipNote text="Total Includes Expertise" />
							)}
							{unitStat.isStat() && unitStat.getStat() === Stat.StatExpertiseRating && <TooltipNote text="Contributes to Spell Hit" />}
						</div>
					}
				/>
			</td>
		</tr>
	);
};
