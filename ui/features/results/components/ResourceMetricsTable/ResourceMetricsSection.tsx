import { ResourceMetrics } from '@sim/proto/sim_result';
import type { ResourceType } from '@generated/proto/spell';
import { useMemo } from 'react';

import { buildMetricRows, type MetricGrouping, type MetricRow } from '../../model/grouping';
import type { SimResultData } from '../../model/result_data';
import { type MetricsColumnDef, MetricsTable } from '../MetricsTable';

const NO_ROWS: Array<MetricRow<ResourceMetrics>> = [];

const resourceGroups = (resultData: SimResultData, resourceType: ResourceType): Array<Array<ResourceMetrics>> => {
	const players = resultData.result.getRaidIndexedPlayers(resultData.filter);
	if (!players.length) return [];

	return ResourceMetrics.groupById(players[0].getResourceMetrics(resourceType));
};

const grouping: MetricGrouping<ResourceMetrics> = {
	merge: metrics => ResourceMetrics.merge(metrics, { removeTag: true, actionIdOverride: metrics[0].unit?.petActionId || undefined }),
	shouldCollapse: () => true,
};

export interface ResourceMetricsSectionProps {
	resourceType: ResourceType;
	title: string;
	columns: Array<MetricsColumnDef<ResourceMetrics>>;
	resultData: SimResultData | null;
}

export const ResourceMetricsSection = ({ resourceType, title, columns, resultData }: ResourceMetricsSectionProps) => {
	const rows = useMemo(() => (resultData ? buildMetricRows(resourceGroups(resultData, resourceType), grouping) : NO_ROWS), [resultData, resourceType]);

	if (!rows.length) return null;

	return (
		<div className="resource-metrics-table-container">
			<span className="resource-metrics-table-title">{title}</span>
			<MetricsTable rootClassName="resource-metrics-table-root" columns={columns} rows={rows} sortColumnId="gain" hasResult={!!resultData} />
		</div>
	);
};
