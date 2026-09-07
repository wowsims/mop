import { bucket } from '@domain/collections';
import { formatToCompactNumber, formatToNumber, formatToPercent } from '@domain/format';
import { ActionMetrics } from '@domain/proto_utils/sim_result';
import { subscribeUiField } from '@domain/state/subscriptions';
import { useSim } from '@features/SimHostContext';
import i18n from '@i18n/config';
import { useStoreSubscribe } from '@ui-kit/hooks/useStoreSubscribe';
import { Tooltip } from '@ui-kit/Tooltip';
import { type ReactNode, useMemo, useRef } from 'react';

import { useSimResult } from '../../hooks/useSimResult';
import { buildMetricRows, indexMetricRows, type MetricGrouping, type MetricRow } from '../../model/grouping';
import type { SimResultData } from '../../model/result_data';
import { MetricsCombinedTooltip, type MetricsCombinedTooltipGroup } from '../MetricsCombinedTooltip';
import { createMetricsColumnHelper, MetricsActionCell, MetricsTable } from '../MetricsTable';
import { MetricsTotalBar } from '../MetricsTotalBar';

const helper = createMetricsColumnHelper<ActionMetrics>();

const NO_ROWS: Array<MetricRow<ActionMetrics>> = [];

const TOOLTIP = {
	damage: 'damage-metrics-damage',
	casts: 'damage-metrics-casts',
	avgCast: 'damage-metrics-avg-cast',
	avgCastHeader: 'damage-metrics-avg-cast-header',
	hits: 'damage-metrics-hits',
	avgHit: 'damage-metrics-avg-hit',
	missPercent: 'damage-metrics-miss-percent',
	dps: 'damage-metrics-dps',
};

const damageGroups = (resultData: SimResultData): Array<Array<ActionMetrics>> => {
	const players = resultData.result.getRaidIndexedPlayers(resultData.filter);
	if (!players.length) return [];

	const player = players[0];
	const actions = player.getDamageActions().map(action => action.forTarget(resultData.filter));
	const petsByName = bucket(player.pets, pet => pet.name);
	const petGroups = Object.values(petsByName).map(pets =>
		ActionMetrics.joinById(
			pets.flatMap(pet => pet.getDamageActions().map(action => action.forTarget(resultData.filter))),
			true,
		),
	);

	return ActionMetrics.groupById(actions).concat(petGroups);
};

const grouping: MetricGrouping<ActionMetrics> = {
	merge: metrics => ActionMetrics.merge(metrics, { removeTag: true, actionIdOverride: metrics[0].unit?.petActionId || undefined }),
	shouldCollapse: metric => !metric.unit?.isPet,
};

const threatGroup = (metric: ActionMetrics, value: number): MetricsCombinedTooltipGroup => ({
	spellSchool: metric.spellSchool,
	totalPercentage: 100,
	data: [{ name: i18n.t('results_tab.details.attack_types.threat'), value, percentage: 100 }],
});

const damageGroup = (metric: ActionMetrics): MetricsCombinedTooltipGroup => {
	const done = metric.damageDone;
	return {
		spellSchool: metric.spellSchool,
		totalPercentage: 100,
		data: [
			{ name: i18n.t('results_tab.details.attack_types.hit'), ...done.hit },
			{ name: i18n.t('results_tab.details.attack_types.critical_hit'), ...done.critHit },
			{ name: i18n.t('results_tab.details.attack_types.tick'), ...done.tick },
			{ name: i18n.t('results_tab.details.attack_types.critical_tick'), ...done.critTick },
			{ name: i18n.t('results_tab.details.attack_types.glancing_blow'), ...done.glance },
			{ name: i18n.t('results_tab.details.attack_types.blocked_glancing_blow'), ...done.glanceBlock },
			{ name: i18n.t('results_tab.details.attack_types.blocked_hit'), ...done.block },
			{ name: i18n.t('results_tab.details.attack_types.blocked_critical_hit'), ...done.critBlock },
		],
	};
};

const castsGroup = (metric: ActionMetrics): MetricsCombinedTooltipGroup => {
	const landed = metric.landedHits || metric.casts;
	return {
		spellSchool: metric.spellSchool,
		totalPercentage: 100,
		data: [
			{
				name: `${i18n.t('results_tab.details.attack_types.hit')}s`,
				value: metric.landedHits || metric.casts - metric.totalMisses,
				percentage: (landed / (landed + metric.totalMisses)) * 100,
			},
			{ name: i18n.t('results_tab.details.attack_types.miss'), value: metric.misses, percentage: metric.missPercent },
			{ name: i18n.t('results_tab.details.attack_types.parry'), value: metric.parries, percentage: metric.parryPercent },
			{ name: i18n.t('results_tab.details.attack_types.dodge'), value: metric.dodges, percentage: metric.dodgePercent },
		],
	};
};

const hitGroups = (metric: ActionMetrics): Array<MetricsCombinedTooltipGroup> => [
	{
		spellSchool: metric.spellSchool,
		totalPercentage: 100,
		data: [
			{ name: i18n.t('results_tab.details.attack_types.hit'), value: metric.hits, percentage: (metric.hits / metric.landedHits) * 100 },
			{ name: i18n.t('results_tab.details.attack_types.critical_hit'), value: metric.crits, percentage: (metric.crits / metric.landedHits) * 100 },
			{ name: i18n.t('results_tab.details.attack_types.glancing_blow'), value: metric.glances, percentage: (metric.glances / metric.landedHits) * 100 },
			{
				name: i18n.t('results_tab.details.attack_types.blocked_glancing_blow'),
				value: metric.glanceBlocks,
				percentage: (metric.glanceBlocks / metric.landedHits) * 100,
			},
			{ name: i18n.t('results_tab.details.attack_types.blocked_hit'), value: metric.blocks, percentage: (metric.blocks / metric.landedHits) * 100 },
			{
				name: i18n.t('results_tab.details.attack_types.blocked_critical_hit'),
				value: metric.critBlocks,
				percentage: (metric.critBlocks / metric.landedHits) * 100,
			},
		],
	},
	{
		spellSchool: metric.spellSchool,
		totalPercentage: 100,
		data: [
			{ name: i18n.t('results_tab.details.attack_types.tick'), value: metric.ticks, percentage: (metric.ticks / metric.landedTicks) * 100 },
			{
				name: i18n.t('results_tab.details.attack_types.critical_tick'),
				value: metric.critTicks,
				percentage: (metric.critTicks / metric.landedTicks) * 100,
			},
		],
	},
];

const missGroup = (metric: ActionMetrics): MetricsCombinedTooltipGroup => ({
	spellSchool: metric.spellSchool,
	totalPercentage: metric.totalMissesPercent,
	data: [
		{ name: i18n.t('results_tab.details.attack_types.miss'), value: metric.misses, percentage: metric.missPercent },
		{ name: i18n.t('results_tab.details.attack_types.parry'), value: metric.parries, percentage: metric.parryPercent },
		{ name: i18n.t('results_tab.details.attack_types.dodge'), value: metric.dodges, percentage: metric.dodgePercent },
	],
});

const withTicks = (primary: number, tick: number, format: typeof formatToNumber) => (
	<>
		{format(primary || tick, { fallbackString: '-' })}
		{!!primary && !!tick && <> ({format(tick, { fallbackString: '-' })})</>}
	</>
);

const rowClassName = (metric: ActionMetrics) => (metric.hitAttempts == 0 && metric.dps == 0 ? 'threat-metrics' : undefined);

export const DamageMetricsTable = () => {
	const resultData = useSimResult();
	const sim = useSim();
	const showThreatMetrics = useStoreSubscribe(
		useMemo(() => subscribeUiField(sim, 'showThreatMetrics'), [sim]),
		() => sim.getShowThreatMetrics(),
	);

	const rows = useMemo(() => (resultData ? buildMetricRows(damageGroups(resultData), grouping) : NO_ROWS), [resultData]);
	const metricsByRowId = useMemo(() => indexMetricRows(rows), [rows]);

	const maxDamage = rows.length ? Math.max(...rows.map(row => row.metric.damage)) : null;
	const maxDamageRef = useRef(maxDamage);
	maxDamageRef.current = maxDamage;

	const columns = useMemo(
		() =>
			helper.columns([
				helper.accessor(row => row.metric.name, {
					id: 'name',
					header: i18n.t('results_tab.details.columns.name'),
					cell: info => (
						<MetricsActionCell
							name={info.row.original.metric.name}
							actionId={info.row.original.metric.actionId}
							expandable={info.row.getCanExpand()}
							expanded={info.row.getIsExpanded()}
							onToggle={info.row.getToggleExpandedHandler()}
						/>
					),
				}),
				helper.accessor(row => row.metric.avgDamage, {
					id: 'damage-done',
					header: i18n.t('results_tab.details.columns.damage_done'),
					meta: { columnClass: 'metrics-table-cell--primary-metric', headerCellClass: 'text-center', tooltipId: TOOLTIP.damage },
					cell: info => {
						const metric = info.row.original.metric;
						return (
							<MetricsTotalBar
								spellSchool={metric.spellSchool}
								percentage={metric.totalDamagePercent}
								max={maxDamageRef.current}
								total={metric.avgDamage}
								value={metric.damage}
							/>
						);
					},
				}),
				helper.accessor(row => row.metric.casts, {
					id: 'casts',
					header: i18n.t('results_tab.details.columns.casts'),
					meta: { tooltipId: TOOLTIP.casts },
					cell: info => formatToNumber(info.getValue(), { fallbackString: '-' }),
				}),
				helper.accessor(row => (row.metric.isPassiveAction ? 0 : row.metric.avgCastHit || row.metric.avgCastTick), {
					id: 'avg-cast',
					header: i18n.t('results_tab.details.columns.avg_cast'),
					meta: {
						tooltipId: TOOLTIP.avgCast,
						headerTooltipId: TOOLTIP.avgCastHeader,
						headerTooltip: i18n.t('results_tab.details.tooltips.damage_avg_cast_tooltip'),
					},
					cell: info => {
						const metric = info.row.original.metric;
						return metric.isPassiveAction ? '-' : withTicks(metric.avgCastHit, metric.avgCastTick, formatToCompactNumber);
					},
				}),
				helper.accessor(row => row.metric.landedHits || row.metric.landedTicks, {
					id: 'hits',
					header: i18n.t('results_tab.details.columns.hits'),
					meta: { tooltipId: TOOLTIP.hits },
					cell: info => withTicks(info.row.original.metric.landedHits, info.row.original.metric.landedTicks, formatToNumber),
				}),
				helper.accessor(row => row.metric.avgHit || row.metric.avgTick, {
					id: 'avg-hit',
					header: i18n.t('results_tab.details.columns.avg_hit'),
					meta: { tooltipId: TOOLTIP.avgHit },
					cell: info => withTicks(info.row.original.metric.avgHit, info.row.original.metric.avgTick, formatToCompactNumber),
				}),
				helper.accessor(row => row.metric.critPercent + row.metric.critBlockPercent || row.metric.critTickPercent, {
					id: 'crit-percent',
					header: i18n.t('results_tab.details.columns.crit_percent'),
					cell: info => {
						const metric = info.row.original.metric;
						const hitCrit = metric.critPercent + metric.critBlockPercent;
						return `${formatToPercent(hitCrit || metric.critTickPercent, { fallbackString: '-' })}${
							hitCrit && metric.critTickPercent ? ` (${formatToPercent(metric.critTickPercent, { fallbackString: '-' })})` : ''
						}`;
					},
				}),
				helper.accessor(row => row.metric.totalMissesPercent, {
					id: 'miss-percent',
					header: i18n.t('results_tab.details.columns.miss_percent'),
					meta: { tooltipId: TOOLTIP.missPercent },
					cell: info => formatToPercent(info.getValue(), { fallbackString: '-' }),
				}),
				helper.accessor(row => row.metric.damageThroughput, {
					id: 'dpet',
					header: i18n.t('results_tab.details.columns.dpet'),
					cell: info => formatToCompactNumber(info.getValue(), { fallbackString: '-' }),
				}),
				helper.accessor(row => row.metric.dps, {
					id: 'dps',
					header: i18n.t('results_tab.details.columns.dps'),
					meta: { columnClass: 'text-success', headerCellClass: 'text-body', tooltipId: TOOLTIP.dps },
					cell: info => formatToNumber(info.getValue(), { minimumFractionDigits: 2, fallbackString: '-' }),
				}),
			]),
		[],
	);

	const forAnchor = (anchor: Element | null, build: (metric: ActionMetrics) => ReactNode) => {
		const metric = metricsByRowId.get(anchor?.getAttribute('data-row-id') ?? '');
		return metric ? build(metric) : null;
	};
	const amount = [undefined, i18n.t('results_tab.details.tooltip_table.amount')];
	const threatTooltip = (metric: ActionMetrics, value: number) =>
		showThreatMetrics && value ? <MetricsCombinedTooltip headerValues={amount} groups={[threatGroup(metric, value)]} /> : null;

	return (
		<>
			<MetricsTable
				rootClassName="damage-metrics-root"
				columns={columns}
				rows={rows}
				sortColumnId="dps"
				hasResult={!!resultData}
				rowClassName={rowClassName}
			/>
			<Tooltip id={TOOLTIP.avgCastHeader} />
			<Tooltip
				id={TOOLTIP.damage}
				className="metrics-table-tooltip"
				render={({ activeAnchor }) =>
					forAnchor(activeAnchor, metric => <MetricsCombinedTooltip headerValues={amount} groups={[damageGroup(metric)]} />)
				}
			/>
			<Tooltip
				id={TOOLTIP.casts}
				className="metrics-table-tooltip"
				render={({ activeAnchor }) =>
					forAnchor(activeAnchor, metric =>
						(!metric.landedHits && !metric.totalMisses) || metric.isPassiveAction ? null : <MetricsCombinedTooltip groups={[castsGroup(metric)]} />,
					)
				}
			/>
			<Tooltip
				id={TOOLTIP.avgCast}
				className="metrics-table-tooltip"
				render={({ activeAnchor }) =>
					forAnchor(activeAnchor, metric => (!metric.avgCastHit && !metric.avgCastTick ? null : threatTooltip(metric, metric.avgCastThreat)))
				}
			/>
			<Tooltip
				id={TOOLTIP.hits}
				className="metrics-table-tooltip"
				render={({ activeAnchor }) =>
					forAnchor(activeAnchor, metric =>
						!metric.landedHits && !metric.landedTicks ? null : <MetricsCombinedTooltip groups={hitGroups(metric)} />,
					)
				}
			/>
			<Tooltip
				id={TOOLTIP.avgHit}
				className="metrics-table-tooltip"
				render={({ activeAnchor }) => forAnchor(activeAnchor, metric => threatTooltip(metric, metric.avgHitThreat))}
			/>
			<Tooltip
				id={TOOLTIP.missPercent}
				className="metrics-table-tooltip"
				render={({ activeAnchor }) =>
					forAnchor(activeAnchor, metric => (metric.totalMissesPercent ? <MetricsCombinedTooltip groups={[missGroup(metric)]} /> : null))
				}
			/>
			<Tooltip
				id={TOOLTIP.dps}
				className="metrics-table-tooltip"
				render={({ activeAnchor }) => forAnchor(activeAnchor, metric => (metric.dps ? threatTooltip(metric, metric.tps) : null))}
			/>
		</>
	);
};
