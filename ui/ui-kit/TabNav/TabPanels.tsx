import type { ClassValue } from 'clsx';
import clsx from 'clsx';
import type { ReactNode } from 'react';

export interface TabPanelsProps {
	className?: ClassValue;
	children?: ReactNode;
	[key: string]: unknown;
}

export const TabPanels = ({ className, children, ...rest }: TabPanelsProps) => (
	<div className={clsx('grid grid-cols-1 items-start pt-section', className)} {...rest}>
		{children}
	</div>
);
