import './CharacterStats.scss';

import { computeStatAttribution, Stats, UnitStat } from '@domain/proto_utils/stats';
import { subscribeAll, subscribePlayerField, subscribeSimChange } from '@domain/state/subscriptions';
import { useSimHost } from '@features/SimHostContext';
import i18n from '@i18n/config';
import { useStoreSubscribe } from '@ui-kit/react/store';
import { useMemo } from 'react';

import { CritCapRow } from './CritCapRow';
import { buildRows } from './rows';
import { meleeCritCapDisplayString, readRacialBonuses, shouldShowMeleeCritCap, statDisplayString } from './stat_display';
import { StatRow } from './StatRow';

/**
 * Takes no props: there is one player per page and one sidebar, and everything this needs is on the
 * host. A `ui-kit` component may not do this — it has to stay sim-agnostic — but a feature component
 * with a single call site would only be re-threading what the context already holds.
 */
export const CharacterStats = () => {
	const host = useSimHost();
	const player = host.player;
	const { displayStats, epReferenceStat, modifyDisplayStats, overwriteDisplayStats } = host.individualConfig;
	const rows = useMemo(() => buildRows(player, displayStats, epReferenceStat), [player, displayStats, epReferenceStat]);

	const subscribe = useMemo(
		() => subscribeAll([subscribePlayerField(player, 'currentStats'), subscribeSimChange(player.sim), subscribePlayerField(player, 'talentsString')]),
		[player],
	);

	// One read per notification, held in between — so building fresh Stats objects here is free of
	// the "getSnapshot should be cached" trap.
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
			racial,
			bonusStats,
			attribution,
			// Only defined for the specs that show the crit-cap row; the getter is meaningless elsewhere.
			critCap: shouldShowMeleeCritCap(player) ? { info: player.getMeleeCritCapInfo(), text: meleeCritCapDisplayString(player) } : null,
		};
	});

	const { racial, bonusStats, attribution, critCap } = snapshot;
	const show = (deltaStats: Stats, unitStat: UnitStat, includeBase?: boolean) => statDisplayString(player, racial, deltaStats, unitStat, includeBase);

	return (
		<div className="character-stats-root">
			<label className="character-stats-label">{i18n.t('sidebar.character_stats.title')}</label>
			<table className="character-stats-table">
				{rows.map(group => (
					<tbody key={group.key}>
						{group.rows.map(row =>
							row.kind === 'stat' ? (
								<StatRow key={row.id} unitStat={row.unitStat} bonusStats={bonusStats} attribution={attribution} show={show} />
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
