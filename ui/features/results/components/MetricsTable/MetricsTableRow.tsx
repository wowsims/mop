import { flexRender, type Row } from '@tanstack/react-table';
import { tooltipAnchorProps } from '@ui-kit/Tooltip';
import clsx from 'clsx';

import type { MetricRow } from '../../model/grouping';
import type { MetricsTableFeatures } from './useMetricsTable';

export interface MetricsTableRowProps<T> {
	row: Row<MetricsTableFeatures, MetricRow<T>>;
	/** `customizeRowElem`: an extra class taken from the row's own metric, on parents and children alike. */
	rowClassName?: (metric: T) => string | undefined;
}

export const MetricsTableRow = <T,>({ row, rowClassName }: MetricsTableRowProps<T>) => {
	const isParent = row.getCanExpand();
	return (
		<tr
			className={
				clsx(
					isParent && 'parent-metric',
					isParent && row.getIsExpanded() && 'expand',
					row.depth > 0 && 'child-metric',
					rowClassName?.(row.original.metric),
				) || undefined
			}
			onClick={isParent ? row.getToggleExpandedHandler() : undefined}>
			{row.getAllCells().map(cell => {
				const tooltipId = cell.column.columnDef.meta?.tooltipId;
				return (
					// The model value, which the display string may round or abbreviate away.
					<td
						key={cell.id}
						className={cell.column.columnDef.meta?.columnClass}
						data-text={String(cell.getValue())}
						{...tooltipAnchorProps(tooltipId)}
						data-row-id={tooltipId ? row.id : undefined}>
						{flexRender(cell.column.columnDef.cell, cell.getContext())}
					</td>
				);
			})}
		</tr>
	);
};
