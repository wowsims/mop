import i18n from '@i18n/config';
import { useSimHost, useSpecConfig } from '@sim/context/SimHostContext';
import { usePlayerStore } from '@sim/hooks/usePlayerStore';
import { computeStatAttribution, Stats, UnitStat } from '@sim/proto/stats';
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
		// eslint-disable-next-line react-hooks/exhaustive-deps -- `gear`, `race` and `inFrontOfTarget` reach the body through the player facade rather than by name; they are the invalidation keys, and dropping them stales the snapshot.
	}, [player, currentStats, bonusStats, gear, race, inFrontOfTarget, modifyDisplayStats, overwriteDisplayStats]);

	const { pending, racial, attribution, critCap } = snapshot;
	const show = (deltaStats: Stats, unitStat: UnitStat, includeBase?: boolean) => statDisplayString(player, racial, deltaStats, unitStat, includeBase);

	return (
		<div data-testid="character-stats-root" className="w-full">
			<h3 data-testid="character-stats-label" className="m-0 mb-2 inline-block text-base leading-tight font-bold">
				{i18n.t('sidebar.character_stats.title')}
			</h3>
			<table className="w-full p-2.5" aria-busy={pending || undefined}>
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
