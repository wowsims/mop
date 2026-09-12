import { AuraMetrics } from '@sim/proto/sim_result';
import i18n from '@i18n/config';
import { useMemo } from 'react';

import { useSimResult } from '../../hooks/useSimResult';
import { buildMetricRows, type MetricGrouping, type MetricRow } from '../../model/grouping';
import type { SimResultData } from '../../model/result_data';
import { createMetricsColumnHelper, MetricsActionCell, MetricsTable } from '../MetricsTable';

const helper = createMetricsColumnHelper<AuraMetrics>();

const NO_ROWS: Array<MetricRow<AuraMetrics>> = [];

const withoutPetAuras = (auras: Array<AuraMetrics>): Array<AuraMetrics> => auras.filter(aura => !aura.unit?.isPet);

const auraGroups = (resultData: SimResultData, useDebuffs: boolean): Array<Array<AuraMetrics>> => {
	if (useDebuffs) return AuraMetrics.groupById(resultData.result.getDebuffMetrics(resultData.filter));

	const players = resultData.result.getRaidIndexedPlayers(resultData.filter);
	if (!players.length) return [];

	const player = players[0];
	return AuraMetrics.groupById(withoutPetAuras(player.auras)).concat(player.pets.map(pet => withoutPetAuras(pet.auras)));
};

const grouping: MetricGrouping<AuraMetrics> = {
	merge: metrics => AuraMetrics.merge(metrics, { removeTag: true, actionIdOverride: metrics[0].unit?.petActionId || undefined }),
	shouldCollapse: metric => !metric.unit?.isPet,
};

export interface AuraMetricsTableProps {
	useDebuffs: boolean;
}

export const AuraMetricsTable = ({ useDebuffs }: AuraMetricsTableProps) => {
	const resultData = useSimResult();
	const rows = useMemo(() => (resultData ? buildMetricRows(auraGroups(resultData, useDebuffs), grouping) : NO_ROWS), [resultData, useDebuffs]);

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
							useBuffAura
							expandable={info.row.getCanExpand()}
							expanded={info.row.getIsExpanded()}
							onToggle={info.row.getToggleExpandedHandler()}
						/>
					),
				}),
				helper.accessor(row => row.metric.averageProcs, {
					id: 'procs',
					header: i18n.t('results_tab.details.columns.procs'),
					cell: info => info.getValue().toFixed(2),
				}),
				helper.accessor(row => row.metric.ppm, {
					id: 'ppm',
					header: i18n.t('results_tab.details.columns.ppm'),
					cell: info => info.getValue().toFixed(2),
				}),
				helper.accessor(row => row.metric.uptimePercent, {
					id: 'uptime',
					header: i18n.t('results_tab.details.columns.uptime'),
					cell: info => `${info.getValue().toFixed(2)}%`,
				}),
			]),
		[],
	);

	return (
		<MetricsTable
			rootClassName={useDebuffs ? 'debuff-metrics-root' : 'buff-metrics-root'}
			columns={columns}
			rows={rows}
			sortColumnId="uptime"
			hasResult={!!resultData}
		/>
	);
};
