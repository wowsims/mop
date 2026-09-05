import './CharacterStats.scss';

import { Player } from '@domain/player';
import { ActionId } from '@domain/proto_utils/action_id';
import { getStatName, masterySpellIDs } from '@domain/proto_utils/names';
import { computeStatAttribution, StatMods, Stats, StatWrites, UnitStat } from '@domain/proto_utils/stats';
import { subscribeAll, subscribePlayerField, subscribeSimChange } from '@domain/state/subscriptions';
import { PseudoStat, Stat } from '@generated/proto/common';
import i18n from '@i18n/config';
import { translateMasterySpellName } from '@i18n/localization';
import { Icon } from '@ui-kit/Icon';
import { NumberPicker } from '@ui-kit/NumberPicker';
import type { NumberPickerConfig } from '@ui-kit/pickers/number_picker';
import { useStoreSubscribe } from '@ui-kit/react/store';
import { Tooltip, type TooltipRefProps } from '@ui-kit/Tooltip';
import clsx from 'clsx';
import { type CSSProperties, useId, useMemo, useRef } from 'react';

import { buildRows, type Row } from './rows';
import {
	bonusStatClass,
	critCapClass,
	masteryScaling,
	meleeCritCapDisplayString,
	readRacialBonuses,
	shouldShowMeleeCritCap,
	statDisplayString,
} from './stat_display';

export interface CharacterStatsProps {
	player: Player<any>;
	statList: Array<UnitStat>;
	/** Decides whether expertise and mastery are grouped with the physical stats or the spell ones. */
	epReferenceStat: Stat;
	modifyDisplayStats?: (player: Player<any>) => StatMods;
	overwriteDisplayStats?: (player: Player<any>) => StatWrites;
}

// One `<td>` deep in the table, so it gets its own component: it owns two tooltips and a picker,
// and the picker must not be rebuilt when the surrounding numbers change.
function BonusStatsLink({ player, rootStat }: { player: Player<any>; rootStat: Stat }) {
	const id = useId();
	const popover = useRef<TooltipRefProps>(null);
	const label = `${i18n.t('sidebar.character_stats.bonus_prefix')} ${getStatName(rootStat)}`;

	const config = useMemo(
		(): NumberPickerConfig<Player<any>> => ({
			id: `character-bonus-stat-${rootStat}`,
			label,
			extraCssClasses: ['mb-0'],
			storeSubscribe: subject => subscribePlayerField(subject, 'bonusStats'),
			getValue: subject => subject.getBonusStats().getStat(rootStat),
			setValue: (subject, newValue) => {
				subject.setBonusStats(subject.getBonusStats().withStat(rootStat, newValue));
				popover.current?.close();
			},
		}),
		[rootStat, label],
	);

	return (
		<>
			{/* The vanilla button carries an inert `data-bs-toggle="popover"`: nothing in the tree ever
			    constructed a Bootstrap popover, and React owns this one. */}
			<button className="add-bonus-stats text-white ms-2" data-tooltip-id={`${id}-popover`}>
				<Icon name="plus-minus" data-tooltip-id={`${id}-icon`} />
			</button>
			<Tooltip id={`${id}-icon`} content={label} />
			<Tooltip
				ref={popover}
				id={`${id}-popover`}
				className="bonus-stats-popover"
				place="right"
				openOnClick
				clickable
				content={<NumberPicker modObject={player} config={config} />}
			/>
		</>
	);
}

const TooltipRow = ({ label, value }: { label: string; value: string }) => (
	<div className="character-stats-tooltip-row">
		<span>{label}</span>
		<span>{value}</span>
	</div>
);

const TooltipNote = ({ text }: { text: string }) => (
	<div className="character-stats-tooltip-row">
		<span>
			<i>{text}</i>
		</span>
	</div>
);

// Bootstrap border utilities at zero opacity: a spacer sized like the value it replaces.
const CRIT_CAP_SPACER_STYLE = { '--bs-border-opacity': '0' } as CSSProperties;

export function CharacterStats({ player, statList, epReferenceStat, modifyDisplayStats, overwriteDisplayStats }: CharacterStatsProps) {
	const rows = useMemo(() => buildRows(player, statList, epReferenceStat), [player, statList, epReferenceStat]);

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
			// Only defined for the specs that show the crit cap row; the getter is meaningless elsewhere.
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
								<StatRow key={row.id} player={player} row={row} bonusStats={bonusStats} attribution={attribution} show={show} />
							) : (
								critCap && <CritCapRow key={row.id} info={critCap.info} text={critCap.text} />
							),
						)}
					</tbody>
				))}
			</table>
		</div>
	);
}

function StatRow({
	player,
	row,
	bonusStats,
	attribution,
	show,
}: {
	player: Player<any>;
	row: Extract<Row, { kind: 'stat' }>;
	bonusStats: Stats;
	attribution: ReturnType<typeof computeStatAttribution>;
	show: (deltaStats: Stats, unitStat: UnitStat, includeBase?: boolean) => string;
}) {
	const id = useId();
	const { unitStat } = row;
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
				{unitStat.hasRootStat() && <BonusStatsLink player={player} rootStat={unitStat.getRootStat()} />}
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
}

function CritCapRow({ info, text }: { info: ReturnType<Player<any>['getMeleeCritCapInfo']>; text: string }) {
	const id = useId();
	return (
		<tr className="character-stats-table-row">
			<td className="character-stats-table-label">{i18n.t('sidebar.character_stats.melee_crit_cap')}</td>
			<td className="character-stats-table-value">
				<div className="stat-value-link-container">
					<button className={clsx('stat-value-link', critCapClass(info.playerCritCapDelta))} data-tooltip-id={id}>
						{`${text} `}
					</button>
				</div>
				<span className="px-2 border-start border-end border-body border-brand" style={CRIT_CAP_SPACER_STYLE} />
				<Tooltip
					id={id}
					content={
						<div>
							<TooltipRow label={i18n.t('sidebar.character_stats.attack_table.glancing')} value={`${info.glancing.toFixed(2)}%`} />
							<TooltipRow label={i18n.t('sidebar.character_stats.attack_table.suppression')} value={`${info.suppression.toFixed(2)}%`} />
							<TooltipRow label={i18n.t('sidebar.character_stats.attack_table.to_hit_cap')} value={`${info.remainingMeleeHitCap.toFixed(2)}%`} />
							<TooltipRow label={i18n.t('sidebar.character_stats.attack_table.to_exp_cap')} value={`${info.remainingExpertiseCap.toFixed(2)}%`} />
							{info.specSpecificOffset !== 0 && (
								<TooltipRow
									label={i18n.t('sidebar.character_stats.attack_table.spec_offsets')}
									value={`${info.specSpecificOffset.toFixed(2)}%`}
								/>
							)}
							<TooltipRow label={i18n.t('sidebar.character_stats.attack_table.final_crit_cap')} value={`${info.baseCritCap.toFixed(2)}%`} />
							<hr />
							<TooltipRow
								label={i18n.t('sidebar.character_stats.attack_table.can_raise_by')}
								value={`${(info.remainingExpertiseCap + info.remainingMeleeHitCap).toFixed(2)}%`}
							/>
						</div>
					}
				/>
			</td>
		</tr>
	);
}
