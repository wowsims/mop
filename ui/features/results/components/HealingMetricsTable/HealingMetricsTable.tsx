import { formatToNumber } from '@domain/format';
import { ActionMetrics } from '@domain/proto_utils/sim_result';
import { subscribeUiField } from '@domain/state/subscriptions';
import { useSim } from '@features/SimHostContext';
import i18n from '@i18n/config';
import { useStoreSubscribe } from '@ui-kit/hooks/useStoreSubscribe';
import { Tooltip } from '@ui-kit/Tooltip';
import { useMemo } from 'react';

import { useSimResult } from '../../hooks/useSimResult';
import { buildMetricRows, indexMetricRows, type MetricGrouping, type MetricRow } from '../../model/grouping';
import type { SimResultData } from '../../model/result_data';
import { attackFormat, attackMetricsColumns, threatTooltip, useMetricMax } from '../AttackMetricsColumns';
import { MetricsCombinedTooltip, type MetricsCombinedTooltipGroup } from '../MetricsCombinedTooltip';
import { createMetricsColumnHelper, metricForAnchor, MetricsTable } from '../MetricsTable';

const helper = createMetricsColumnHelper<ActionMetrics>();

const NO_ROWS: Array<MetricRow<ActionMetrics>> = [];

const TOOLTIP = {
	healing: 'healing-metrics-healing',
	avgCast: 'healing-metrics-avg-cast',
	avgCastHeader: 'healing-metrics-avg-cast-header',
	hits: 'healing-metrics-hits',
	hitsHeader: 'healing-metrics-hits-header',
	avgHit: 'healing-metrics-avg-hit',
	avgHitHeader: 'healing-metrics-avg-hit-header',
	hps: 'healing-metrics-hps',
};

const healingGroups = (resultData: SimResultData): Array<Array<ActionMetrics>> => {
	const players = resultData.result.getRaidIndexedPlayers(resultData.filter);
	if (!players.length) return [];

	return ActionMetrics.groupById(players[0].getHealingActions().filter(action => action.hps > 0));
};

const grouping: MetricGrouping<ActionMetrics> = {
	merge: metrics => ActionMetrics.merge(metrics, { removeTag: true, actionIdOverride: metrics[0]?.unit?.petActionId || undefined }),
	shouldCollapse: metric => !metric.unit?.isPet,
};

const healingGroup = (metric: ActionMetrics): MetricsCombinedTooltipGroup => ({
	spellSchool: metric.spellSchool,
	totalPercentage: 100,
	data: [
		{
			name: i18n.t('results_tab.details.attack_types.hit'),
			value: metric.avgHealing - metric.avgCritHealing,
			percentage: metric.healingPercent,
			average: (metric.avgHealing - metric.avgCritHealing) / (metric.hits || metric.ticks),
		},
		{
			name: i18n.t('results_tab.details.attack_types.critical_hit'),
			value: metric.avgCritHealing,
			percentage: metric.healingCritPercent,
			average: metric.avgCritHealing / (metric.crits || metric.critTicks),
		},
	],
});

const healingHitGroups = (metric: ActionMetrics): Array<MetricsCombinedTooltipGroup> => [
	{
		spellSchool: metric.spellSchool,
		totalPercentage: 100,
		name: 'Hits',
		data: [
			{ name: i18n.t('results_tab.details.attack_types.hit'), value: metric.hits, percentage: (metric.hits / metric.landedHits) * 100 },
			{ name: i18n.t('results_tab.details.attack_types.critical_hit'), value: metric.crits, percentage: (metric.crits / metric.landedHits) * 100 },
			{ name: i18n.t('results_tab.details.attack_types.glancing_blow'), value: metric.glances, percentage: (metric.glances / metric.landedHits) * 100 },
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
		name: 'Ticks',
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

const rowClassName = (metric: ActionMetrics) => (metric.hitAttempts == 0 && metric.hps == 0 ? 'threat-metrics' : undefined);

export const HealingMetricsTable = () => {
	const resultData = useSimResult();
	const sim = useSim();
	const showThreatMetrics = useStoreSubscribe(
		useMemo(() => subscribeUiField(sim, 'showThreatMetrics'), [sim]),
		() => sim.getShowThreatMetrics(),
	);

	const rows = useMemo(() => (resultData ? buildMetricRows(healingGroups(resultData), grouping) : NO_ROWS), [resultData]);
	const metricsByRowId = useMemo(() => indexMetricRows(rows), [rows]);
	const maxHealing = useMetricMax(rows, metric => metric.healing);

	const columns = useMemo(
		() =>
			helper.columns([
				attackMetricsColumns.name(),
				attackMetricsColumns.primary({
					id: 'healing-done',
					header: i18n.t('results_tab.details.columns.healing_done'),
					total: metric => metric.avgHealing,
					value: metric => metric.healing,
					percentage: metric => metric.totalHealingPercent,
					max: maxHealing,
					overlay: metric => metric.shielding,
					tooltipId: TOOLTIP.healing,
				}),
				attackMetricsColumns.casts(),
				helper.accessor(row => row.metric.castsPerMinute, {
					id: 'cpm',
					header: i18n.t('results_tab.details.columns.cpm'),
					cell: info => attackFormat.number(info.getValue()),
				}),
				helper.accessor(row => row.metric.avgCastTimeMs, {
					id: 'cast-time',
					header: i18n.t('results_tab.details.columns.cast_time'),
					cell: info => formatToNumber(info.getValue() / 1000, { minimumFractionDigits: 2, fallbackString: '-' }),
				}),
				helper.accessor(row => row.metric.avgCastHealing, {
					id: 'avg-cast',
					header: i18n.t('results_tab.details.columns.avg_cast'),
					meta: {
						tooltipId: TOOLTIP.avgCast,
						headerTooltipId: TOOLTIP.avgCastHeader,
						headerTooltip: i18n.t('results_tab.details.tooltips.healing_avg_cast_tooltip'),
					},
					cell: info => attackFormat.compact(info.getValue()),
				}),
				helper.accessor(row => row.metric.landedHits, {
					id: 'hits',
					header: i18n.t('results_tab.details.columns.hits'),
					meta: {
						tooltipId: TOOLTIP.hits,
						headerTooltipId: TOOLTIP.hitsHeader,
						headerTooltip: i18n.t('results_tab.details.tooltips.healing_hits_tooltip'),
					},
					cell: info => {
						const metric = info.row.original.metric;
						return (
							<>
								{attackFormat.number(metric.landedHits)}
								{!!metric.landedTicks && <> ({attackFormat.number(metric.landedTicks)})</>}{' '}
							</>
						);
					},
				}),
				helper.accessor(row => row.metric.avgHitHealing, {
					id: 'avg-hit',
					header: i18n.t('results_tab.details.columns.avg_hit'),
					meta: {
						tooltipId: TOOLTIP.avgHit,
						headerTooltipId: TOOLTIP.avgHitHeader,
						headerTooltip: i18n.t('results_tab.details.tooltips.healing_avg_hit_tooltip'),
					},
					cell: info => attackFormat.compact(info.getValue()),
				}),
				helper.accessor(row => row.metric.hpm, {
					id: 'hpm',
					header: i18n.t('results_tab.details.columns.hpm'),
					cell: info => attackFormat.compact(info.getValue()),
				}),
				helper.accessor(row => row.metric.critPercent || row.metric.critTickPercent, {
					id: 'crit-percent',
					header: i18n.t('results_tab.details.columns.crit_percent'),
					cell: info => attackFormat.percent(info.getValue()),
				}),
				helper.accessor(row => row.metric.healingThroughput, {
					id: 'hpet',
					header: i18n.t('results_tab.details.columns.hpet'),
					cell: info => attackFormat.compact(info.getValue()),
				}),
				attackMetricsColumns.rate({
					id: 'hps',
					header: i18n.t('results_tab.details.columns.hps'),
					value: metric => metric.hps,
					tooltipId: TOOLTIP.hps,
				}),
			]),
		[maxHealing],
	);

	const forAnchor = metricForAnchor(metricsByRowId);

	return (
		<>
			<MetricsTable
				rootClassName="healing-metrics-root"
				columns={columns}
				rows={rows}
				sortColumnId="hps"
				hasResult={!!resultData}
				rowClassName={rowClassName}
			/>
			<Tooltip id={TOOLTIP.avgCastHeader} />
			<Tooltip id={TOOLTIP.hitsHeader} />
			<Tooltip id={TOOLTIP.avgHitHeader} />
			<Tooltip
				id={TOOLTIP.healing}
				className="metrics-table-tooltip"
				render={({ activeAnchor }) => forAnchor(activeAnchor, metric => <MetricsCombinedTooltip groups={[healingGroup(metric)]} />)}
			/>
			<Tooltip
				id={TOOLTIP.avgCast}
				className="metrics-table-tooltip"
				render={({ activeAnchor }) =>
					forAnchor(activeAnchor, metric => (metric.avgCastHealing ? threatTooltip(metric, metric.avgCastThreat, showThreatMetrics) : null))
				}
			/>
			<Tooltip
				id={TOOLTIP.hits}
				className="metrics-table-tooltip"
				render={({ activeAnchor }) =>
					forAnchor(activeAnchor, metric =>
						!metric.landedHits && !metric.landedTicks ? null : <MetricsCombinedTooltip groups={healingHitGroups(metric)} />,
					)
				}
			/>
			<Tooltip
				id={TOOLTIP.avgHit}
				className="metrics-table-tooltip"
				render={({ activeAnchor }) =>
					forAnchor(activeAnchor, metric => (metric.avgHitHealing ? threatTooltip(metric, metric.avgHitThreat, showThreatMetrics) : null))
				}
			/>
			<Tooltip
				id={TOOLTIP.hps}
				className="metrics-table-tooltip"
				render={({ activeAnchor }) => forAnchor(activeAnchor, metric => threatTooltip(metric, metric.tps, showThreatMetrics))}
			/>
		</>
	);
};
