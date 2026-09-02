import i18n from '../../../i18n/config';
import { ActionMetrics } from '../../proto_utils/sim_result';
import { formatToCompactNumber, formatToNumber, formatToPercent } from '../../utils';
import { MetricsCombinedTooltipTable } from './metrics_table/metrics_combined_tooltip_table';
import { ColumnSortType, MetricsTable } from './metrics_table/metrics_table';
import { MetricsTotalBar } from './metrics_table/metrics_total_bar';
import { ResultComponentConfig, SimResultData } from './result_component';

export class HealingMetricsTable extends MetricsTable<ActionMetrics> {
	maxHealingAmount: number | null = null;
	constructor(config: ResultComponentConfig) {
		config.rootCssClass = 'healing-metrics-root';
		config.resultsEmitter.on(resultData => {
			const lastResult = resultData
				? this.getGroupedMetrics(resultData)
						.filter(g => g.length)
						.map(groups => this.mergeMetrics(groups))
				: undefined;
			this.maxHealingAmount = Math.max(...(lastResult || []).map(a => a.healing));
		});
		super(config, [
			MetricsTable.nameCellConfig((metric: ActionMetrics) => {
				return {
					name: metric.name,
					actionId: metric.actionId,
					metricType: metric.constructor?.name,
				};
			}),
			{
				name: i18n.t('results_tab.details.columns.healing_done'),
				headerCellClass: 'text-center metrics-table-cell--primary-metric',
				columnClass: 'metrics-table-cell--primary-metric',
				getValue: (metric: ActionMetrics) => metric.avgHealing,
				fillCell: (metric: ActionMetrics, cellElem: HTMLElement) => {
					cellElem.appendChild(
						<MetricsTotalBar
							spellSchool={metric.spellSchool}
							percentage={metric.totalHealingPercent}
							max={this.maxHealingAmount}
							total={metric.avgHealing}
							value={metric.healing}
							overlayValue={metric.shielding}
						/>,
					);

					cellElem.appendChild(
						<MetricsCombinedTooltipTable
							tooltipElement={cellElem}
							groups={[
								{
									spellSchool: metric.spellSchool,
									total: metric.avgHealing,
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
								},
							]}
						/>,
					);
				},
			},
			{
				name: i18n.t('results_tab.details.columns.casts'),
				getValue: (metric: ActionMetrics) => metric.casts,
				getDisplayString: (metric: ActionMetrics) => formatToNumber(metric.casts, { fallbackString: '-' }),
			},
			{
				name: i18n.t('results_tab.details.columns.cpm'),
				getValue: (metric: ActionMetrics) => metric.castsPerMinute,
				getDisplayString: (metric: ActionMetrics) => formatToNumber(metric.castsPerMinute, { fallbackString: '-' }),
			},
			{
				name: i18n.t('results_tab.details.columns.cast_time'),
				getValue: (metric: ActionMetrics) => metric.avgCastTimeMs,
				getDisplayString: (metric: ActionMetrics) => formatToNumber(metric.avgCastTimeMs / 1000, { minimumFractionDigits: 2, fallbackString: '-' }),
			},
			{
				name: i18n.t('results_tab.details.columns.avg_cast'),
				tooltip: i18n.t('results_tab.details.tooltips.healing_avg_cast_tooltip'),
				getValue: (metric: ActionMetrics) => metric.avgCastHealing,
				fillCell: (metric: ActionMetrics, cellElem: HTMLElement) => {
					cellElem.appendChild(<>{formatToCompactNumber(metric.avgCastHealing, { fallbackString: '-' })}</>);
					if (!metric.avgCastHealing) return;

					cellElem.appendChild(
						<MetricsCombinedTooltipTable
							tooltipElement={cellElem}
							tooltipConfig={{
								onShow: () => {
									const hideThreatMetrics = !!document.querySelector('.hide-threat-metrics');
									if (hideThreatMetrics) return false;
								},
							}}
							headerValues={[, i18n.t('results_tab.details.tooltip_table.amount')]}
							groups={[
								{
									spellSchool: metric.spellSchool,
									total: metric.avgCastThreat,
									totalPercentage: 100,
									data: [
										{
											name: i18n.t('results_tab.details.attack_types.threat'),
											value: metric.avgCastThreat,
											percentage: 100,
										},
									],
								},
							]}
						/>,
					);
				},
			},
			{
				name: i18n.t('results_tab.details.columns.hits'),
				tooltip: i18n.t('results_tab.details.tooltips.healing_hits_tooltip'),
				getValue: (metric: ActionMetrics) => metric.landedHits,
				fillCell: (metric: ActionMetrics, cellElem: HTMLElement) => {
					cellElem.appendChild(
						<>
							{formatToNumber(metric.landedHits, { fallbackString: '-' })}
							{metric.landedTicks ? <> ({formatToNumber(metric.landedTicks, { fallbackString: '-' })})</> : undefined}{' '}
						</>,
					);
					if (!metric.landedHits && !metric.landedTicks) return;

					const relativeHitPercent = (metric.hits / metric.landedHits) * 100;
					const relativeCritPercent = (metric.crits / metric.landedHits) * 100;
					const relativeTickPercent = (metric.ticks / metric.landedTicks) * 100;
					const relativeCritTickPercent = (metric.critTicks / metric.landedTicks) * 100;
					const relativeGlancePercent = (metric.glances / metric.landedHits) * 100;
					const relativeBlockPercent = (metric.blocks / metric.landedHits) * 100;
					const relativeCritBlockPercent = (metric.critBlocks / metric.landedHits) * 100;

					cellElem.appendChild(
						<MetricsCombinedTooltipTable
							tooltipElement={cellElem}
							groups={[
								{
									spellSchool: metric.spellSchool,
									total: metric.landedHits,
									totalPercentage: 100,
									name: 'Hits',
									data: [
										{
											name: i18n.t('results_tab.details.attack_types.hit'),
											value: metric.hits,
											percentage: relativeHitPercent,
										},
										{
											name: i18n.t('results_tab.details.attack_types.critical_hit'),
											value: metric.crits,
											percentage: relativeCritPercent,
										},
										{
											name: i18n.t('results_tab.details.attack_types.glancing_blow'),
											value: metric.glances,
											percentage: relativeGlancePercent,
										},
										{
											name: i18n.t('results_tab.details.attack_types.blocked_hit'),
											value: metric.blocks,
											percentage: relativeBlockPercent,
										},
										{
											name: i18n.t('results_tab.details.attack_types.blocked_critical_hit'),
											value: metric.critBlocks,
											percentage: relativeCritBlockPercent,
										},
									],
								},
								{
									spellSchool: metric.spellSchool,
									total: metric.landedTicks,
									totalPercentage: 100,
									name: 'Ticks',
									data: [
										{
											name: i18n.t('results_tab.details.attack_types.tick'),
											value: metric.ticks,
											percentage: relativeTickPercent,
										},
										{
											name: i18n.t('results_tab.details.attack_types.critical_tick'),
											value: metric.critTicks,
											percentage: relativeCritTickPercent,
										},
									],
								},
							]}
						/>,
					);
				},
			},
			{
				name: i18n.t('results_tab.details.columns.avg_hit'),
				tooltip: i18n.t('results_tab.details.tooltips.healing_avg_hit_tooltip'),
				getValue: (metric: ActionMetrics) => metric.avgHitHealing,
				fillCell: (metric: ActionMetrics, cellElem: HTMLElement) => {
					cellElem.appendChild(<>{formatToCompactNumber(metric.avgHitHealing, { fallbackString: '-' })}</>);
					if (!metric.avgHitHealing) return;

					cellElem.appendChild(
						<MetricsCombinedTooltipTable
							tooltipElement={cellElem}
							tooltipConfig={{
								onShow: () => {
									const hideThreatMetrics = !!document.querySelector('.hide-threat-metrics');
									if (hideThreatMetrics) return false;
								},
							}}
							headerValues={[, i18n.t('results_tab.details.tooltip_table.amount')]}
							groups={[
								{
									spellSchool: metric.spellSchool,
									total: metric.avgHitThreat,
									totalPercentage: 100,
									data: [
										{
											name: i18n.t('results_tab.details.attack_types.threat'),
											value: metric.avgHitThreat,
											percentage: 100,
										},
									],
								},
							]}
						/>,
					);
				},
			},
			{
				name: i18n.t('results_tab.details.columns.hpm'),
				getValue: (metric: ActionMetrics) => metric.hpm,
				getDisplayString: (metric: ActionMetrics) => formatToCompactNumber(metric.hpm, { fallbackString: '-' }),
			},

			{
				name: i18n.t('results_tab.details.columns.crit_percent'),
				getValue: (metric: ActionMetrics) => metric.critPercent || metric.critTickPercent,
				getDisplayString: (metric: ActionMetrics) => formatToPercent(metric.critPercent || metric.critTickPercent, { fallbackString: '-' }),
			},
			{
				name: i18n.t('results_tab.details.columns.hpet'),
				getValue: (metric: ActionMetrics) => metric.healingThroughput,
				getDisplayString: (metric: ActionMetrics) => formatToCompactNumber(metric.healingThroughput, { fallbackString: '-' }),
			},
			{
				name: i18n.t('results_tab.details.columns.hps'),
				sort: ColumnSortType.Descending,
				headerCellClass: 'text-body',
				columnClass: 'text-success',
				getValue: (metric: ActionMetrics) => metric.hps,
				fillCell: (metric: ActionMetrics, cellElem: HTMLElement) => {
					cellElem.appendChild(<>{formatToNumber(metric.hps, { minimumFractionDigits: 2 })}</>);

					cellElem.appendChild(
						<MetricsCombinedTooltipTable
							tooltipElement={cellElem}
							tooltipConfig={{
								onShow: () => {
									const hideThreatMetrics = !!document.querySelector('.hide-threat-metrics');
									if (hideThreatMetrics) return false;
								},
							}}
							headerValues={[, i18n.t('results_tab.details.tooltip_table.amount')]}
							groups={[
								{
									spellSchool: metric.spellSchool,
									total: metric.tps,
									totalPercentage: 100,
									data: [
										{
											name: i18n.t('results_tab.details.attack_types.threat'),
											value: metric.tps,
											percentage: 100,
										},
									],
								},
							]}
						/>,
					);
				},
			},
		]);
	}

	customizeRowElem(action: ActionMetrics, rowElem: HTMLElement) {
		if (action.hitAttempts == 0 && action.hps == 0) {
			rowElem.classList.add('threat-metrics');
		}
	}

	getGroupedMetrics(resultData: SimResultData): Array<Array<ActionMetrics>> {
		const players = resultData.result.getRaidIndexedPlayers(resultData.filter);
		if (players.length != 1) {
			return [];
		}
		const player = players[0];

		//const actions = player.getSpellActions().map(action => action.forTarget(resultData.filter));
		// TODO: Do we want to show 0 hps metrics in here? Make it conditional for healing sims
		// in case they want to show the threat for non healing spells
		const actions = player.getHealingActions().filter(action => action.hps > 0);
		const actionGroups = ActionMetrics.groupById(actions);

		return actionGroups;
	}

	mergeMetrics(metrics: Array<ActionMetrics>): ActionMetrics {
		return ActionMetrics.merge(metrics, {
			removeTag: true,
			actionIdOverride: metrics[0]?.unit?.petActionId || undefined,
		});
	}

	shouldCollapse(metric: ActionMetrics): boolean {
		return !metric.unit?.isPet;
	}
}
