import clsx from 'clsx';
import type { ReactNode } from 'react';

export interface SummaryTableRowProps {
	children?: ReactNode;
	className?: string;
}

export const SummaryTableRow = ({ children, className }: SummaryTableRowProps) => (
	<div className={clsx('summary-table-row d-flex align-items-center', className)}>{children}</div>
);
