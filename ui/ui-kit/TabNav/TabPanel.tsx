import { Tabs } from '@base-ui/react/tabs';
import type { ClassValue } from 'clsx';
import clsx from 'clsx';
import type { ReactNode } from 'react';

export interface TabPanelProps {
	value: string;
	id?: string;
	keepMounted?: boolean;
	className?: ClassValue;
	children?: ReactNode;
}

export const TabPanel = ({ value, id, keepMounted = true, className, children }: TabPanelProps) => (
	<Tabs.Panel
		value={value}
		id={id ?? value}
		keepMounted={keepMounted}
		data-testid="tab-pane"
		className={clsx('col-start-1 row-start-1 fade-in-out', className, 'data-ending-style:opacity-0 data-starting-style:opacity-0')}>
		{children}
	</Tabs.Panel>
);
