import type { SortDirection } from '@tanstack/react-table';
import { Button } from '@ui-kit/Button';
import { tooltipAnchorProps } from '@ui-kit/Tooltip';
import clsx from 'clsx';

import { type MetricsColumnDef, useMetricsTable } from '../../hooks/useMetricsTable';
import type { MetricRow } from '../../model/grouping';
import { MetricsTableRow } from './MetricsTableRow';

const ariaSort = (direction: false | SortDirection) => (direction === 'asc' ? 'ascending' : direction === 'desc' ? 'descending' : 'none');

export interface MetricsTableProps<T> {
	/** The root div's `data-testid`, which the gates address the table by. */
	rootTestId: string;
	columns: Array<MetricsColumnDef<T>>;
	rows: Array<MetricRow<T>>;
	sortColumnId: string;
	/** Whether a run has completed. A table with no rows hides only once one has — never at load. */
	hasResult: boolean;
	rowThreatOnly?: (metric: T) => boolean;
}

export const MetricsTable = <T,>({ rootTestId, columns, rows, sortColumnId, hasResult, rowThreatOnly }: MetricsTableProps<T>) => {
	const table = useMetricsTable({ columns, rows, sortColumnId });

	if (hasResult && !rows.length) return null;

	return (
		<div data-testid={rootTestId}>
			<table data-testid="metrics-table" className="ui-metrics-table">
				<thead data-testid="metrics-table-header">
					{table.getHeaderGroups().map(headerGroup => (
						<tr data-testid="metrics-table-header-row" className="ui-metrics-header-row" key={headerGroup.id}>
							{headerGroup.headers.map(header => (
								<th
									key={header.id}
									data-testid="metrics-table-header-cell"
									data-primary-metric={header.column.columnDef.meta?.primaryColumn ? '' : undefined}
									className={clsx(
										'ui-metrics-header-cell',
										header.column.columnDef.meta?.columnClass,
										header.column.columnDef.meta?.headerCellClass,
									)}
									aria-sort={ariaSort(header.column.getIsSorted())}
									onClick={header.column.getToggleSortingHandler()}
									{...tooltipAnchorProps(header.column.columnDef.meta?.headerTooltipId, header.column.columnDef.meta?.headerTooltip)}>
									<Button
										data-testid="metrics-table-sort"
										variant="unstyled"
										className="text-inherit [font:inherit] focus-visible:focus-ring">
										<span>
											<table.FlexRender header={header} />
										</span>
									</Button>
								</th>
							))}
						</tr>
					))}
				</thead>
				<tbody data-testid="metrics-table-body">
					{table.getRowModel().rows.map(row => (
						<MetricsTableRow key={row.id} row={row} rowThreatOnly={rowThreatOnly} />
					))}
				</tbody>
			</table>
		</div>
	);
};
