import { formatToNumber, formatToPercent } from '@sim/utils/format';
import i18n from '@i18n/config';
import type { ReactNode } from 'react';

import type { ResultMetrics } from '../../model/sim_results';
import type { ResultMetric, ResultMetricUnit } from '../../model/topline_metrics';

/** `row` is the detailed-results one-row table; `list` is the sidebar's stacked column. */
export type ResultMetricLayout = 'row' | 'list';

const errorDecimals = (unit: ResultMetricUnit) => (unit === 'percentage' ? 2 : 0);

export const formatAverage = ({ average, unit }: ResultMetric, layout: ResultMetricLayout): string => {
	if (layout === 'list') return average.toFixed(2);

	switch (unit) {
		case 'percentage':
			return formatToPercent(average);
		case 'seconds':
			return formatToNumber(average, { style: 'unit', unit: 'second', unitDisplay: 'narrow' });
		default:
			return formatToNumber(average);
	}
};

export const formatStdev = ({ stdev, unit }: ResultMetric, layout: ResultMetricLayout): string =>
	layout === 'list' ? (stdev ?? 0).toFixed(errorDecimals(unit)) : formatToNumber(stdev ?? 0, { maximumFractionDigits: errorDecimals(unit) });

/** TMI and CoD are percentages: they carry their sign on the label (`12.34% TMI`) and their tooltip is the long form's title. */
const isPercentageMetric = (metric: keyof ResultMetrics): boolean => metric === 'tmi' || metric === 'cod';

export const metricLabelPrefix = (metric: keyof ResultMetrics): string => (isPercentageMetric(metric) ? '% ' : ' ');

/** The reference delta the sidebar's `updateReference` fills in; inert everywhere else. */
export const resultReferenceDiff = (): ReactNode => (
	<div className="results-reference hide">
		<span className="results-reference-diff"></span> {i18n.t('sidebar.results.reference.vs_ref')}
	</div>
);

/** The row layout gets the one-line form on every metric; the list gets the long form and skips out-of-mana. */
export const resultMetricTooltip = (metric: keyof ResultMetrics | null, layout: ResultMetricLayout): ReactNode => {
	if (!metric) return null;

	if (layout === 'row') return i18n.t(`sidebar.results.metrics.${metric}.${isPercentageMetric(metric) ? 'tooltip.title' : 'tooltip'}`);

	switch (metric) {
		case 'oom':
			return null;
		case 'tmi':
			return (
				<>
					<p>{i18n.t('sidebar.results.metrics.tmi.tooltip.title')}</p>
					<p>{i18n.t('sidebar.results.metrics.tmi.tooltip.description')}</p>
					<p>
						<b>{i18n.t('sidebar.results.metrics.tmi.tooltip.note')}</b>
					</p>
				</>
			);
		case 'cod':
			return (
				<>
					<p>{i18n.t('sidebar.results.metrics.cod.tooltip.title')}</p>
					<p>{i18n.t('sidebar.results.metrics.cod.tooltip.description')}</p>
					<p>{i18n.t('sidebar.results.metrics.cod.tooltip.note')}</p>
				</>
			);
		default:
			return i18n.t(`sidebar.results.metrics.${metric}.tooltip`);
	}
};
