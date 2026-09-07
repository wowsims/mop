import { flexRender, type Row } from '@tanstack/react-table';
import clsx from 'clsx';

import type { MetricRow } from '../../model/grouping';
import type { MetricsTableFeatures } from './useMetricsTable';

export interface MetricsTableRowProps<T> {
	row: Row<MetricsTableFeatures, MetricRow<T>>;
}

export const MetricsTableRow = <T,>({ row }: MetricsTableRowProps<T>) => {
	const isParent = row.getCanExpand();
	return (
		<tr
			className={clsx(isParent && 'parent-metric', isParent && row.getIsExpanded() && 'expand', row.depth > 0 && 'child-metric') || undefined}
			onClick={isParent ? row.getToggleExpandedHandler() : undefined}>
			{row.getAllCells().map(cell => (
				// The model value, which the display string may round or abbreviate away.
				<td key={cell.id} className={cell.column.columnDef.meta?.columnClass} data-text={String(cell.getValue())}>
					{flexRender(cell.column.columnDef.cell, cell.getContext())}
				</td>
			))}
		</tr>
	);
};
