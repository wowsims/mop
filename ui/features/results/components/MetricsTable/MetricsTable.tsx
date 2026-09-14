import type { SortDirection } from '@tanstack/react-table';
import { Button } from '@ui-kit/Button';
import { tooltipAnchorProps } from '@ui-kit/Tooltip';
import clsx from 'clsx';

import type { MetricRow } from '../../model/grouping';
import { MetricsTableRow } from './MetricsTableRow';
import { type MetricsColumnDef, useMetricsTable } from '../../hooks/useMetricsTable';

const ariaSort = (direction: false | SortDirection) => (direction === 'asc' ? 'ascending' : direction === 'desc' ? 'descending' : 'none');

export interface MetricsTableProps<T> {
	/** The root div's `data-testid`, which the gates address the table by. */
	rootTestId: string;
	columns: Array<MetricsColumnDef<T>>;
	rows: Array<MetricRow<T>>;
	sortColumnId: string;
	/** Whether a run has completed. A table with no rows hides only once one has — never at load. */
	hasResult: boolean;
	/** `customizeRowElem`: an extra class taken from the row's own metric. */
	rowClassName?: (metric: T) => string | undefined;
}

export const MetricsTable = <T,>({ rootTestId, columns, rows, sortColumnId, hasResult, rowClassName }: MetricsTableProps<T>) => {
	const table = useMetricsTable({ columns, rows, sortColumnId });

	if (hasResult && !rows.length) return null;

	return (
		<div data-testid={rootTestId}>
			<table className="metrics-table ui-metrics-table">
				<thead className="metrics-table-header">
					{table.getHeaderGroups().map(headerGroup => (
						<tr className="metrics-table-header-row ui-metrics-header-row" key={headerGroup.id}>
							{headerGroup.headers.map(header => (
								<th
									key={header.id}
									className={clsx(
										'metrics-table-header-cell ui-metrics-header-cell',
										header.column.columnDef.meta?.columnClass,
										header.column.columnDef.meta?.headerCellClass,
									)}
									aria-sort={ariaSort(header.column.getIsSorted())}
									onClick={header.column.getToggleSortingHandler()}
									{...tooltipAnchorProps(header.column.columnDef.meta?.headerTooltipId, header.column.columnDef.meta?.headerTooltip)}>
									<Button variant="unstyled" className="metrics-table-sort text-inherit [font:inherit] focus-visible:focus-ring">
										<span>
											<table.FlexRender header={header} />
										</span>
									</Button>
								</th>
							))}
						</tr>
					))}
				</thead>
				<tbody className="metrics-table-body">
					{table.getRowModel().rows.map(row => (
						<MetricsTableRow key={row.id} row={row} rowClassName={rowClassName} />
					))}
				</tbody>
			</table>
		</div>
	);
};
