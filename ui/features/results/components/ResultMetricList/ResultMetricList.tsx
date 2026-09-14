import { Tooltip, tooltipAnchorProps } from '@ui-kit/Tooltip';
import clsx from 'clsx';
import { useId } from 'react';

import type { ReferenceDiffs } from '../../model/reference_diffs';
import type { ResultMetrics } from '../../model/sim_results';
import type { ResultMetric } from '../../model/topline_metrics';
import { ResultReferenceDiff } from './ResultReferenceDiff';
import { formatAverage, formatStdev, hasMetricTooltip, type ResultMetricLayout, resultMetricTooltip } from './utils';

export interface ResultMetricListProps {
	metrics: Array<ResultMetric>;
	layout: ResultMetricLayout;
	referenceDiffs?: ReferenceDiffs;
}

export const ResultMetricList = ({ metrics, layout, referenceDiffs }: ResultMetricListProps) => {
	const tooltipId = useId();
	const diffTooltipId = useId();
	const anchorFor = (metric: keyof ResultMetrics) => tooltipAnchorProps(hasMetricTooltip(metric, layout) ? tooltipId : undefined);

	return (
		<>
			{layout === 'row' ? (
				<table className="metrics-table ui-metrics-table">
					<thead className="metrics-table-header">
						<tr className="metrics-table-header-row ui-metrics-header-row">
							{metrics.map(({ metric, name, classes }) => (
								<th
									key={metric}
									className={clsx('metrics-table-header-cell ui-metrics-header-cell font-bold', classes)}
									data-metric={metric}
									{...anchorFor(metric)}>
									{name}
								</th>
							))}
						</tr>
					</thead>
					<tbody className="metrics-table-body">
						<tr className="ui-metrics-row">
							{metrics.map(column => (
								<td key={column.metric} className={clsx('text-center align-top ui-metrics-cell font-bold', column.classes)}>
									<div className="topline-result-avg text-2xl">{formatAverage(column, layout)}</div>
									{column.stdev ? (
										<div className="topline-result-stdev text-ui font-normal">
											<i className="fas fa-plus-minus fa-xs"></i> {formatStdev(column, layout)}
										</div>
									) : undefined}
									<ResultReferenceDiff diff={referenceDiffs?.[column.metric]} tooltipId={diffTooltipId} />
								</td>
							))}
						</tr>
					</tbody>
				</table>
			) : (
				metrics.map(column => (
					<div
						key={column.metric}
						className={clsx('results-metric text-left font-bold', column.classes)}
						data-metric={column.metric}
						{...anchorFor(column.metric)}>
						<span className="topline-result-avg text-2xl">
							{formatAverage(column, layout)}
							<span className="metric-label text-ui font-normal"> {column.name}</span>
						</span>
						{!!column.stdev && (
							<span className="topline-result-stdev text-ui font-normal">
								(<i className="fas fa-plus-minus fa-xs"></i>
								{formatStdev(column, layout)})
							</span>
						)}
						<ResultReferenceDiff diff={referenceDiffs?.[column.metric]} tooltipId={diffTooltipId} />
					</div>
				))
			)}
			<Tooltip
				id={tooltipId}
				place={layout === 'list' ? 'right' : 'top'}
				render={({ activeAnchor }) => resultMetricTooltip(activeAnchor?.getAttribute('data-metric') as keyof ResultMetrics | null, layout)}
			/>
			{referenceDiffs && <Tooltip id={diffTooltipId} />}
		</>
	);
};
