import clsx from 'clsx';
import type { ReactNode } from 'react';

export interface SummaryTableRowProps {
	children?: ReactNode;
	className?: string;
}

export const SummaryTableRow = ({ children, className }: SummaryTableRowProps) => (
	<div className={clsx('summary-table-row flex items-center [&>*:last-child]:ml-auto', className)}>{children}</div>
);
