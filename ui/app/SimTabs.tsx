import './SimTabs.scss';

import { Tabs } from '@base-ui/react/tabs';
import { childProps } from '@ui-kit/child_props';
import type { SimTabActivation } from '@ui-kit/tab_activation';
import clsx from 'clsx';
import { type ReactNode, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';

import { trackPageView } from '../tracking/analytics';
import type { SimTabDefProps } from './SimTabDef';

export interface SimTabsProps {
	activation: SimTabActivation;
	panes: HTMLElement;
	children: ReactNode;
}

export const SimTabs = ({ activation, panes, children }: SimTabsProps) => {
	const activeId = useSyncExternalStore(activation.subscribe, activation.getActiveId);
	const tabs = childProps<SimTabDefProps>(children);
	// Resolved here, not in the store: the store does not know the tabs, so both the null it starts
	// on and an id no tab carries fall back to the first tab.
	const value = tabs.find(tab => tab.id === activeId)?.id ?? tabs[0]?.id;

	return (
		<Tabs.Root
			className="sim-tabs-root"
			value={value}
			onValueChange={next => {
				const id = String(next);
				activation.activate(id);
				trackPageView(tabs.find(tab => tab.id === id)?.title ?? id, id);
			}}>
			<Tabs.List className="sim-tabs" activateOnFocus>
				{tabs.map(tab => (
					<Tabs.Tab key={tab.id} value={tab.id} className={clsx('sim-tab-link', tab.id)}>
						{tab.title}
						{tab.badge && (
							<>
								{' ('}
								<span className="text-success">{tab.badge}</span>
								{')'}
							</>
						)}
					</Tabs.Tab>
				))}
			</Tabs.List>
			{/* The one portal the shell keeps: `Tabs.Root` has to be a React ancestor of both the strip and the panes, and their nearest common DOM ancestor is `.sim-content`. */}
			{createPortal(
				<>
					{tabs.map(tab => (
						// `keepMounted`: every pane is built once and three of them read the live document, so none may be unmounted.
						<Tabs.Panel key={tab.id} value={tab.id} keepMounted className="sim-tab-panel">
							{tab.children}
						</Tabs.Panel>
					))}
				</>,
				panes,
			)}
		</Tabs.Root>
	);
};
