import './CharacterStats.scss';

import { useSimHost, useSpecConfig } from '@sim/context/SimHostContext';
import { computeStatAttribution, Stats, UnitStat } from '@sim/proto/stats';
import i18n from '@i18n/config';
import { usePlayerStore } from '@sim/hooks/usePlayerStore';
import { useMemo } from 'react';

import { CritCapRow } from './CritCapRow';
import { StatRow } from './StatRow';
import { buildRows } from './utils/rows';
import { meleeCritCapDisplayString, readRacialBonuses, shouldShowMeleeCritCap, statDisplayString } from './utils/stat_display';

export const CharacterStats = () => {
	const host = useSimHost();
	const player = host.player;
	const { displayStats, epReferenceStat, modifyDisplayStats, overwriteDisplayStats } = useSpecConfig();
	const rows = useMemo(() => buildRows(player, displayStats, epReferenceStat), [player, displayStats, epReferenceStat]);

	const currentStats = usePlayerStore('currentStats');
	const bonusStats = usePlayerStore('bonusStats');
	const gear = usePlayerStore('gear');
	const race = usePlayerStore('race');
	const inFrontOfTarget = usePlayerStore('inFrontOfTarget');

	const snapshot = useMemo(() => {
		const racial = readRacialBonuses(player);
		const attribution = computeStatAttribution(
			player.getCurrentStats(),
			bonusStats,
			player.getBaseMastery(),
			modifyDisplayStats ? modifyDisplayStats(player) : {},
			overwriteDisplayStats ? overwriteDisplayStats(player) : undefined,
		);
		return {
			pending: !currentStats.finalStats,
			racial,
			attribution,
			critCap: shouldShowMeleeCritCap(player) ? { info: player.getMeleeCritCapInfo(), text: meleeCritCapDisplayString(player) } : null,
		};
		// `gear`, `race` and `inFrontOfTarget` reach the body through the player facade, not by name: they are invalidation keys, and dropping them from the list would stale the snapshot.
	}, [player, currentStats, bonusStats, gear, race, inFrontOfTarget, modifyDisplayStats, overwriteDisplayStats]);

	const { pending, racial, attribution, critCap } = snapshot;
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
