import { ActionMetrics } from '@domain/proto_utils/sim_result';
import i18n from '@i18n/config';
import { useMemo } from 'react';

import { useSimResult } from '../../hooks/useSimResult';
import { buildMetricRows, type MetricGrouping, type MetricRow } from '../../model/grouping';
import type { SimResultData } from '../../model/result_data';
import { createMetricsColumnHelper, MetricsActionCell, MetricsTable } from '../MetricsTable';

const helper = createMetricsColumnHelper<ActionMetrics>();

const NO_ROWS: Array<MetricRow<ActionMetrics>> = [];

const castGroups = (resultData: SimResultData): Array<Array<ActionMetrics>> => {
	const players = resultData.result.getRaidIndexedPlayers(resultData.filter);
	if (!players.length) return [];

	const player = players[0];
	const actions = player.actions.filter(action => action.casts != 0).map(action => action.forTarget(resultData.filter));
	const petGroups = player.pets.map(pet => pet.actions.filter(action => action.casts != 0).map(action => action.forTarget(resultData.filter)));

	return ActionMetrics.groupById(actions).concat(petGroups);
};

const grouping: MetricGrouping<ActionMetrics> = {
	merge: metrics => ActionMetrics.merge(metrics, { removeTag: true, actionIdOverride: metrics[0].unit?.petActionId || undefined }),
	shouldCollapse: metric => !metric.unit?.isPet,
};

export const CastMetricsTable = () => {
	const resultData = useSimResult();
	const rows = useMemo(() => (resultData ? buildMetricRows(castGroups(resultData), grouping) : NO_ROWS), [resultData]);

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
				helper.accessor(row => row.metric.casts, {
					id: 'casts',
					header: i18n.t('results_tab.details.columns.casts'),
					cell: info => info.getValue().toFixed(1),
				}),
				helper.accessor(row => row.metric.castsPerMinute, {
					id: 'cpm',
					header: i18n.t('results_tab.details.columns.cpm'),
					cell: info => info.getValue().toFixed(1),
				}),
			]),
		[],
	);

	return <MetricsTable rootClassName="cast-metrics-root" columns={columns} rows={rows} sortColumnId="casts" hasResult={!!resultData} />;
};
