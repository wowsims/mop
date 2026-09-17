import { Tooltip, tooltipAnchorProps } from '@ui-kit/Tooltip';
import clsx from 'clsx';
import { useId } from 'react';

import type { ReferenceDiffs } from '../../model/reference_diffs';
import { resultMetricCategories, type ResultMetrics } from '../../model/sim_results';
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
				<table data-testid="metrics-table" className="ui-metrics-table">
					<thead data-testid="metrics-table-header">
						<tr data-testid="metrics-table-header-row" className="ui-metrics-header-row">
							{metrics.map(({ metric, name, extraClass }) => (
								<th
									key={metric}
									data-testid="metrics-table-header-cell"
									className={clsx('ui-metrics-header-cell font-bold', extraClass)}
									data-metric={metric}
									data-metric-category={resultMetricCategories[metric]}
									{...anchorFor(metric)}>
									{name}
								</th>
							))}
						</tr>
					</thead>
					<tbody data-testid="metrics-table-body">
						<tr className="ui-metrics-row">
							{metrics.map(column => (
								<td key={column.metric} className={clsx('ui-metrics-cell text-center align-top font-bold', column.extraClass)}>
									<div data-testid="topline-result-avg" className="text-2xl">
										{formatAverage(column, layout)}
									</div>
									{column.stdev ? (
										<div data-testid="topline-result-stdev" className="text-ui font-normal">
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
						data-testid="results-metric"
						className={clsx('text-left font-bold', column.extraClass)}
						data-metric={column.metric}
						data-metric-category={resultMetricCategories[column.metric]}
						{...anchorFor(column.metric)}>
						<span data-testid="topline-result-avg" className="text-2xl">
							{formatAverage(column, layout)}
							<span className="text-ui font-normal"> {column.name}</span>
						</span>
						{!!column.stdev && (
							<span data-testid="topline-result-stdev" className="text-ui font-normal">
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
