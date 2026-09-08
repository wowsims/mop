import { Tooltip, tooltipAnchorProps } from '@ui-kit/Tooltip';
import clsx from 'clsx';
import { useId } from 'react';

import type { ResultMetrics } from '../../model/sim_results';
import type { ResultMetric } from '../../model/topline_metrics';
import { formatAverage, formatStdev, hasMetricTooltip, metricLabelPrefix, ResultReferenceDiff, type ResultMetricLayout, resultMetricTooltip } from './utils';

export interface ResultMetricListProps {
	metrics: Array<ResultMetric>;
	layout: ResultMetricLayout;
}

export const ResultMetricList = ({ metrics, layout }: ResultMetricListProps) => {
	const tooltipId = useId();
	const anchorFor = (metric: keyof ResultMetrics) => tooltipAnchorProps(hasMetricTooltip(metric, layout) ? tooltipId : undefined);

	return (
		<>
			{layout === 'row' ? (
				<table className="metrics-table">
					<thead className="metrics-table-header">
						<tr className="metrics-table-header-row">
							{metrics.map(({ metric, name, classes }) => (
								<th key={metric} className={clsx('metrics-table-header-cell', classes)} data-metric={metric} {...anchorFor(metric)}>
									{name}
								</th>
							))}
						</tr>
					</thead>
					<tbody className="metrics-table-body">
						<tr>
							{metrics.map(column => (
								<td key={column.metric} className={clsx('text-center align-top', column.classes)}>
									<div className="topline-result-avg">{formatAverage(column, layout)}</div>
									{column.stdev ? (
										<div className="topline-result-stdev">
											<i className="fas fa-plus-minus fa-xs"></i> {formatStdev(column, layout)}
										</div>
									) : undefined}
									<ResultReferenceDiff />
								</td>
							))}
						</tr>
					</tbody>
				</table>
			) : (
				metrics.map(column => (
					<div key={column.metric} className={clsx('results-metric', column.classes)} data-metric={column.metric} {...anchorFor(column.metric)}>
						<span className="topline-result-avg">
							{formatAverage(column, layout)}
							<span className="metric-label">
								{metricLabelPrefix(column.metric)}
								{column.name}
							</span>
						</span>
						{!!column.stdev && (
							<span className="topline-result-stdev">
								(<i className="fas fa-plus-minus fa-xs"></i>
								{formatStdev(column, layout)})
							</span>
						)}
						<ResultReferenceDiff />
					</div>
				))
			)}
			<Tooltip
				id={tooltipId}
				place={layout === 'list' ? 'right' : 'top'}
				render={({ activeAnchor }) => resultMetricTooltip(activeAnchor?.getAttribute('data-metric') as keyof ResultMetrics | null, layout)}
			/>
		</>
	);
};
