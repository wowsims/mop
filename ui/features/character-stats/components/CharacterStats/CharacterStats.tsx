import './CharacterStats.scss';

import { computeStatAttribution, Stats, UnitStat } from '@domain/proto_utils/stats';
import { subscribeAll, subscribePlayerField, subscribeSimChange } from '@domain/state/subscriptions';
import { useSimHost } from '@features/SimHostContext';
import i18n from '@i18n/config';
import { useStoreSubscribe } from '@ui-kit/hooks/useStoreSubscribe';
import { useMemo } from 'react';

import { CritCapRow } from './CritCapRow';
import { StatRow } from './StatRow';
import { buildRows } from './utils/rows';
import { meleeCritCapDisplayString, readRacialBonuses, shouldShowMeleeCritCap, statDisplayString } from './utils/stat_display';

export const CharacterStats = () => {
	const host = useSimHost();
	const player = host.player;
	const { displayStats, epReferenceStat, modifyDisplayStats, overwriteDisplayStats } = host.individualConfig;
	const rows = useMemo(() => buildRows(player, displayStats, epReferenceStat), [player, displayStats, epReferenceStat]);

	const subscribe = useMemo(
		() => subscribeAll([subscribePlayerField(player, 'currentStats'), subscribeSimChange(player.sim), subscribePlayerField(player, 'talentsString')]),
		[player],
	);

	const snapshot = useStoreSubscribe(subscribe, () => {
		const racial = readRacialBonuses(player);
		const bonusStats = player.getBonusStats();
		const attribution = computeStatAttribution(
			player.getCurrentStats(),
			bonusStats,
			player.getBaseMastery(),
			modifyDisplayStats ? modifyDisplayStats(player) : {},
			overwriteDisplayStats ? overwriteDisplayStats(player) : undefined,
		);
		return {
			pending: !player.getCurrentStats().finalStats,
			racial,
			bonusStats,
			attribution,
			critCap: shouldShowMeleeCritCap(player) ? { info: player.getMeleeCritCapInfo(), text: meleeCritCapDisplayString(player) } : null,
		};
	});

	const { pending, racial, bonusStats, attribution, critCap } = snapshot;
	const show = (deltaStats: Stats, unitStat: UnitStat, includeBase?: boolean) => statDisplayString(player, racial, deltaStats, unitStat, includeBase);

	return (
		<div className="character-stats-root">
			<h3 className="character-stats-label">{i18n.t('sidebar.character_stats.title')}</h3>
			<table className="character-stats-table" aria-busy={pending || undefined}>
				{rows.map(group => (
					<tbody key={group.key}>
						{group.rows.map(row =>
							row.kind === 'stat' ? (
								<StatRow key={row.id} unitStat={row.unitStat} bonusStats={bonusStats} attribution={attribution} show={show} pending={pending} />
							) : (
								critCap && <CritCapRow key={row.id} info={critCap.info} text={critCap.text} />
							),
						)}
					</tbody>
				))}
			</table>
		</div>
	);
};
