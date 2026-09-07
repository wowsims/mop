import './MetricsTable.scss';

import clsx from 'clsx';

import type { MetricRow } from '../../model/grouping';
import { MetricsTableRow } from './MetricsTableRow';
import { type MetricsColumnDef, useMetricsTable } from './useMetricsTable';

export interface MetricsTableProps<T> {
	/** The root div's class, which the stylesheet and the gates address the table by. */
	rootClassName: string;
	columns: Array<MetricsColumnDef<T>>;
	rows: Array<MetricRow<T>>;
	sortColumnId: string;
	/** Whether a run has completed. A table with no rows hides only once one has — never at load. */
	hasResult: boolean;
}

export const MetricsTable = <T,>({ rootClassName, columns, rows, sortColumnId, hasResult }: MetricsTableProps<T>) => {
	const table = useMetricsTable({ columns, rows, sortColumnId });

	return (
		<div className={clsx(rootClassName, hasResult && !rows.length && 'hide')}>
			<table className="metrics-table tablesorter">
				<thead className="metrics-table-header">
					{table.getHeaderGroups().map(headerGroup => (
						<tr className="metrics-table-header-row" key={headerGroup.id}>
							{headerGroup.headers.map(header => (
								<th
									key={header.id}
									className={clsx(
										'metrics-table-header-cell',
										header.column.columnDef.meta?.columnClass,
										header.column.columnDef.meta?.headerCellClass,
									)}
									onClick={header.column.getToggleSortingHandler()}>
									<span>
										<table.FlexRender header={header} />
									</span>
								</th>
							))}
						</tr>
					))}
				</thead>
				<tbody className="metrics-table-body">
					{table.getRowModel().rows.map(row => (
						<MetricsTableRow key={row.id} row={row} />
					))}
				</tbody>
			</table>
		</div>
	);
};
