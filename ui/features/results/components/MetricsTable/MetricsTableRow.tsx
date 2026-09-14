import { flexRender, type Row } from '@tanstack/react-table';
import { tooltipAnchorProps } from '@ui-kit/Tooltip';
import clsx from 'clsx';

import type { MetricsTableFeatures } from '../../hooks/useMetricsTable';
import type { MetricRow } from '../../model/grouping';

export interface MetricsTableRowProps<T> {
	row: Row<MetricsTableFeatures, MetricRow<T>>;
	/** `customizeRowElem`: an extra class taken from the row's own metric, on parents and children alike. */
	rowClassName?: (metric: T) => string | undefined;
}

export const MetricsTableRow = <T,>({ row, rowClassName }: MetricsTableRowProps<T>) => {
	const isParent = row.getCanExpand();
	return (
		<tr
			className={clsx('ui-metrics-row', isParent && 'cursor-pointer', rowClassName?.(row.original.metric))}
			data-parent={isParent ? '' : undefined}
			data-child={row.depth > 0 ? '' : undefined}
			data-expanded={isParent && row.getIsExpanded() ? '' : undefined}
			onClick={isParent ? row.getToggleExpandedHandler() : undefined}>
			{row.getAllCells().map((cell, index) => {
				const tooltipId = cell.column.columnDef.meta?.tooltipId;
				return (
					// The model value, which the display string may round or abbreviate away.
					<td
						key={cell.id}
						data-primary-metric={cell.column.columnDef.meta?.primaryColumn ? '' : undefined}
						className={clsx(
							'ui-metrics-cell',
							row.depth > 0 && index === 0 && 'pl-[20px]',
							cell.column.columnDef.meta?.columnClass,
							cell.column.columnDef.meta?.dataClass,
						)}
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
