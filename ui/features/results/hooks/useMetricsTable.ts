import {
	type ColumnDef,
	createColumnHelper,
	createExpandedRowModel,
	createSortedRowModel,
	rowExpandingFeature,
	rowSortingFeature,
	type SortFn,
	tableFeatures,
	useTable,
} from '@tanstack/react-table';
import { useMemo } from 'react';

import { compareMetricValues, type MetricRow, metricRowId } from '../model/grouping';
import type { MetricsColumnMeta } from '../components/MetricsTable/types';

export const metricsTableFeatures = tableFeatures({
	rowSortingFeature,
	sortedRowModel: createSortedRowModel(),
	rowExpandingFeature,
	expandedRowModel: createExpandedRowModel(),
	columnMeta: {} as MetricsColumnMeta,
});

export type MetricsTableFeatures = typeof metricsTableFeatures;

export type MetricsColumnDef<T> = ColumnDef<MetricsTableFeatures, MetricRow<T>, any>;

export const createMetricsColumnHelper = <T>() => createColumnHelper<MetricsTableFeatures, MetricRow<T>>();

const sortByMetricValue: SortFn<MetricsTableFeatures, MetricRow<any>> = (rowA, rowB, columnId) =>
	compareMetricValues(rowA.getValue(columnId), rowB.getValue(columnId));

const getSubRows = <T>(row: MetricRow<T>) => row.subRows;

const getRowId = <T>(_row: MetricRow<T>, index: number, parent?: { id: string }) => metricRowId(index, parent?.id);

export interface UseMetricsTableOptions<T> {
	columns: Array<MetricsColumnDef<T>>;
	rows: Array<MetricRow<T>>;
	/** The column `MetricsTable` opens sorted descending. */
	sortColumnId: string;
}

export const useMetricsTable = <T>({ columns, rows, sortColumnId }: UseMetricsTableOptions<T>) => {
	// `sortFn: 'auto'` would give the Name column `sortFn_text`, which is not `localeCompare`.
	const sortedColumns = useMemo(() => columns.map(column => ({ sortFn: sortByMetricValue, ...column })), [columns]);

	const options = useMemo(
		() => ({
			features: metricsTableFeatures,
			columns: sortedColumns,
			data: rows,
			getSubRows,
			getRowId,
			// `TableSorter`'s cycle: first click ascending on every column, no removal, no multi-sort.
			enableSortingRemoval: false,
			enableMultiSort: false,
			sortDescFirst: false,
			// `addGroup` expands every parent on every result; `autoResetExpanded` restores this on new data.
			initialState: { sorting: [{ id: sortColumnId, desc: true }], expanded: true as const },
		}),
		[sortedColumns, rows, sortColumnId],
	);

	return useTable(options);
};
