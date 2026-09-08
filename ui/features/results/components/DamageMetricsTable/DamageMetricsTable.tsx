import { bucket } from '@sim/utils/collections';
import { useSim } from '@sim/context/SimHostContext';
import { ActionMetrics } from '@sim/proto_utils/sim_result';
import { subscribeUiField } from '@sim/state/subscriptions';
import i18n from '@i18n/config';
import { useStoreSubscribe } from '@ui-kit/hooks/useStoreSubscribe';
import { Tooltip } from '@ui-kit/Tooltip';
import { useMemo } from 'react';

import { useSimResult } from '../../hooks/useSimResult';
import { buildMetricRows, indexMetricRows, type MetricGrouping, type MetricRow } from '../../model/grouping';
import type { SimResultData } from '../../model/result_data';
import {
	amountHeader,
	attackFormat,
	attackMetricsColumns,
	castsGroup,
	damageBreakdownGroup,
	hitGroups,
	missGroup,
	threatTooltip,
	useMetricMax,
} from '../AttackMetricsColumns';
import { MetricsCombinedTooltip } from '../MetricsCombinedTooltip';
import { createMetricsColumnHelper, metricForAnchor, MetricsTable } from '../MetricsTable';

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
	const maxDamage = useMetricMax(rows, metric => metric.damage);

	const columns = useMemo(
		() =>
			helper.columns([
				attackMetricsColumns.name(),
				attackMetricsColumns.primary({
					id: 'damage-done',
					header: i18n.t('results_tab.details.columns.damage_done'),
					total: metric => metric.avgDamage,
					value: metric => metric.damage,
					percentage: metric => metric.totalDamagePercent,
					max: maxDamage,
					tooltipId: TOOLTIP.damage,
				}),
				attackMetricsColumns.casts({ tooltipId: TOOLTIP.casts }),
				attackMetricsColumns.withTicks({
					id: 'avg-cast',
					header: i18n.t('results_tab.details.columns.avg_cast'),
					value: metric => metric.avgCastHit,
					tick: metric => metric.avgCastTick,
					format: attackFormat.compact,
					zeroWhen: metric => metric.isPassiveAction,
					dashWhen: metric => metric.isPassiveAction,
					meta: {
						tooltipId: TOOLTIP.avgCast,
						headerTooltipId: TOOLTIP.avgCastHeader,
						headerTooltip: i18n.t('results_tab.details.tooltips.damage_avg_cast_tooltip'),
					},
				}),
				attackMetricsColumns.withTicks({
					id: 'hits',
					header: i18n.t('results_tab.details.columns.hits'),
					value: metric => metric.landedHits,
					tick: metric => metric.landedTicks,
					format: attackFormat.number,
					meta: { tooltipId: TOOLTIP.hits },
				}),
				attackMetricsColumns.withTicks({
					id: 'avg-hit',
					header: i18n.t('results_tab.details.columns.avg_hit'),
					value: metric => metric.avgHit,
					tick: metric => metric.avgTick,
					format: attackFormat.compact,
					meta: { tooltipId: TOOLTIP.avgHit },
				}),
				attackMetricsColumns.withTicks({
					id: 'crit-percent',
					header: i18n.t('results_tab.details.columns.crit_percent'),
					value: metric => metric.critPercent + metric.critBlockPercent,
					tick: metric => metric.critTickPercent,
					format: attackFormat.percent,
				}),
				helper.accessor(row => row.metric.totalMissesPercent, {
					id: 'miss-percent',
					header: i18n.t('results_tab.details.columns.miss_percent'),
					meta: { tooltipId: TOOLTIP.missPercent },
					cell: info => attackFormat.percent(info.getValue()),
				}),
				helper.accessor(row => row.metric.damageThroughput, {
					id: 'dpet',
					header: i18n.t('results_tab.details.columns.dpet'),
					cell: info => attackFormat.compact(info.getValue()),
				}),
				attackMetricsColumns.rate({
					id: 'dps',
					header: i18n.t('results_tab.details.columns.dps'),
					value: metric => metric.dps,
					tooltipId: TOOLTIP.dps,
				}),
			]),
		[maxDamage],
	);

	const forAnchor = metricForAnchor(metricsByRowId);

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
					forAnchor(activeAnchor, metric => <MetricsCombinedTooltip headerValues={amountHeader()} groups={[damageBreakdownGroup(metric)]} />)
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
					forAnchor(activeAnchor, metric =>
						!metric.avgCastHit && !metric.avgCastTick ? null : threatTooltip(metric, metric.avgCastThreat, showThreatMetrics),
					)
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
				render={({ activeAnchor }) => forAnchor(activeAnchor, metric => threatTooltip(metric, metric.avgHitThreat, showThreatMetrics))}
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
				render={({ activeAnchor }) => forAnchor(activeAnchor, metric => (metric.dps ? threatTooltip(metric, metric.tps, showThreatMetrics) : null))}
			/>
		</>
	);
};
