/** @jsxImportSource @jsx-vanilla */
import { resourceNames } from '@domain/proto_utils/names';
import SecondaryResource from '@domain/proto_utils/secondary_resource';
import { ResourceMetrics } from '@domain/proto_utils/sim_result';
import { orderedResourceTypes } from '@domain/proto_utils/utils';
import { ResourceType } from '@generated/proto/spell';
import i18n from '@i18n/config';
import { translateResourceType } from '@i18n/localization';

import { ColumnSortType, MetricsTable } from './metrics_table/metrics_table';
import { ResultComponent, ResultComponentConfig, SimResultData } from './result_component';

interface ResourceMetricsTableConfig extends ResultComponentConfig {
	secondaryResource?: SecondaryResource | null;
}

export class ResourceMetricsTable extends ResultComponent {
	constructor(config: ResourceMetricsTableConfig) {
		config.rootCssClass = 'resource-metrics-root';
		super(config);

		orderedResourceTypes.forEach(resourceType => {
			let resourceName = resourceNames.get(resourceType);
			if (resourceType == ResourceType.ResourceTypeGenericResource && !!config.secondaryResource) {
				resourceName = config.secondaryResource.name;
			} else {
				resourceName = translateResourceType(resourceType);
			}

			const containerElem = (
				<div className="resource-metrics-table-container hide">
					<span className="resource-metrics-table-title">{resourceName}</span>
				</div>
			) as HTMLElement;
			this.rootElem.appendChild(containerElem);

			const table = new TypedResourceMetricsTable({ ...config, parent: containerElem }, resourceType);
			table.onUpdate.on(() => {
				if (table.rootElem.classList.contains('hide')) {
					containerElem.classList.add('hide');
				} else {
					containerElem.classList.remove('hide');
				}
			});
		});
	}

	// eslint-disable-next-line @typescript-eslint/no-empty-function
	onSimResult() {}
}

export class TypedResourceMetricsTable extends MetricsTable<ResourceMetrics> {
	readonly resourceType: ResourceType;

	constructor(config: ResultComponentConfig, resourceType: ResourceType) {
		config.rootCssClass = 'resource-metrics-table-root';
		super(config, [
			MetricsTable.nameCellConfig((metric: ResourceMetrics) => {
				return {
					name: metric.name,
					actionId: metric.actionId,
					metricType: metric.constructor?.name,
				};
			}),
			{
				name: i18n.t('results_tab.details.columns.casts'),
				getValue: (metric: ResourceMetrics) => metric.events,
				getDisplayString: (metric: ResourceMetrics) => metric.events.toFixed(1),
			},
			{
				name: i18n.t('results_tab.details.columns.gain'),
				sort: ColumnSortType.Descending,
				getValue: (metric: ResourceMetrics) => metric.gain,
				getDisplayString: (metric: ResourceMetrics) => metric.gain.toFixed(1),
			},
			{
				name: i18n.t('results_tab.details.columns.gain_per_second'),
				getValue: (metric: ResourceMetrics) => metric.gainPerSecond,
				getDisplayString: (metric: ResourceMetrics) => metric.gainPerSecond.toFixed(1),
			},
			{
				name: i18n.t('results_tab.details.columns.avg_gain'),
				getValue: (metric: ResourceMetrics) => metric.avgGain,
				getDisplayString: (metric: ResourceMetrics) => metric.avgGain.toFixed(1),
			},
			{
				name: i18n.t('results_tab.details.columns.wasted_gain'),
				getValue: (metric: ResourceMetrics) => metric.wastedGain,
				getDisplayString: (metric: ResourceMetrics) => metric.wastedGain.toFixed(1),
			},
		]);
		this.resourceType = resourceType;
	}

	getGroupedMetrics(resultData: SimResultData): Array<Array<ResourceMetrics>> {
		const players = resultData.result.getRaidIndexedPlayers(resultData.filter);
		if (!players.length) {
			return [];
		}
		const player = players[0];

		const resources = player.getResourceMetrics(this.resourceType);
		const resourceGroups = ResourceMetrics.groupById(resources);
		return resourceGroups;
	}

	mergeMetrics(metrics: Array<ResourceMetrics>): ResourceMetrics {
		return ResourceMetrics.merge(metrics, {
			removeTag: true,
			actionIdOverride: metrics[0].unit?.petActionId || undefined,
		});
	}
}
