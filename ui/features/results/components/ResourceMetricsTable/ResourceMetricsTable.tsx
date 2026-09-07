import './ResourceMetricsTable.scss';

import { ResourceMetrics } from '@domain/proto_utils/sim_result';
import { orderedResourceTypes } from '@domain/proto_utils/utils';
import { usePlayer } from '@features/SimHostContext';
import { ResourceType } from '@generated/proto/spell';
import i18n from '@i18n/config';
import { translateResourceType } from '@i18n/localization';
import { useMemo } from 'react';

import { useSimResult } from '../../hooks/useSimResult';
import { createMetricsColumnHelper, MetricsActionCell } from '../MetricsTable';
import { ResourceMetricsSection } from './ResourceMetricsSection';

const helper = createMetricsColumnHelper<ResourceMetrics>();

export const ResourceMetricsTable = () => {
	const resultData = useSimResult();
	const secondaryResource = usePlayer().secondaryResource;

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
				helper.accessor(row => row.metric.events, {
					id: 'casts',
					header: i18n.t('results_tab.details.columns.casts'),
					cell: info => info.getValue().toFixed(1),
				}),
				helper.accessor(row => row.metric.gain, {
					id: 'gain',
					header: i18n.t('results_tab.details.columns.gain'),
					cell: info => info.getValue().toFixed(1),
				}),
				helper.accessor(row => row.metric.gainPerSecond, {
					id: 'gain-per-second',
					header: i18n.t('results_tab.details.columns.gain_per_second'),
					cell: info => info.getValue().toFixed(1),
				}),
				helper.accessor(row => row.metric.avgGain, {
					id: 'avg-gain',
					header: i18n.t('results_tab.details.columns.avg_gain'),
					cell: info => info.getValue().toFixed(1),
				}),
				helper.accessor(row => row.metric.wastedGain, {
					id: 'wasted-gain',
					header: i18n.t('results_tab.details.columns.wasted_gain'),
					cell: info => info.getValue().toFixed(1),
				}),
			]),
		[],
	);

	return (
		<div className="resource-metrics-root">
			{orderedResourceTypes.map(resourceType => (
				<ResourceMetricsSection
					key={resourceType}
					resourceType={resourceType}
					title={
						resourceType === ResourceType.ResourceTypeGenericResource && secondaryResource?.name
							? secondaryResource.name
							: translateResourceType(resourceType)
					}
					columns={columns}
					resultData={resultData}
				/>
			))}
		</div>
	);
};
