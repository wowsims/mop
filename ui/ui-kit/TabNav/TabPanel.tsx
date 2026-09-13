import { Tabs, type TabsPanelState } from '@base-ui/react/tabs';
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

const tabPaneClass = (state: TabsPanelState, extra?: ClassValue) => {
	const active = !state.hidden && state.transitionStatus !== 'ending';
	const show = active && state.transitionStatus !== 'starting';
	return clsx('tab-pane fade-in-out', extra, active && 'active', show && 'show', !show && 'opacity-0');
};

export const TabPanel = ({ value, id, keepMounted = true, className, children }: TabPanelProps) => (
	<Tabs.Panel value={value} id={id ?? value} keepMounted={keepMounted} className={state => tabPaneClass(state, className)}>
		{children}
	</Tabs.Panel>
);
