import clsx from 'clsx';
import type { ReactNode } from 'react';

export interface SummaryTableRowProps {
	children?: ReactNode;
	className?: string;
}

export const SummaryTableRow = ({ children, className }: SummaryTableRowProps) => (
	<div className={clsx('flex items-center [&_*:last-child]:ml-auto', className)} data-testid="summary-table-row">
		{children}
	</div>
);
