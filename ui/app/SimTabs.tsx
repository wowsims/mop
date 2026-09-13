import { Tabs } from '@base-ui/react/tabs';
import { childProps } from '@ui-kit/child_props';
import { TabActivationContext } from '@ui-kit/tab_activation';
import { TabNav } from '@ui-kit/TabNav';
import { type ReactNode, useState } from 'react';
import { createPortal } from 'react-dom';

import { trackPageView } from '../tracking/analytics';
import type { SimTabDefProps } from './SimTabDef';

export interface SimTabsProps {
	panes: HTMLElement;
	children: ReactNode;
}

export const SimTabs = ({ panes, children }: SimTabsProps) => {
	const [activeId, setActiveId] = useState<string | null>(null);
	const tabs = childProps<SimTabDefProps>(children);
	// The first tab is the one open on load, and an id no tab carries falls back to it.
	const value = tabs.find(tab => tab.id === activeId)?.id ?? tabs[0]?.id;

	return (
		<TabActivationContext value={setActiveId}>
			<Tabs.Root
				className="sim-tabs-root contents"
				value={value}
				onValueChange={next => {
					const id = String(next);
					setActiveId(id);
					trackPageView(tabs.find(tab => tab.id === id)?.title ?? id, id);
				}}>
				<TabNav variant="sim" testId="sim-tabs" tabs={tabs.map(tab => ({ id: tab.id, label: tab.title, badge: tab.badge }))} />
				{/* The one portal the shell keeps: `Tabs.Root` has to be a React ancestor of both the strip and the panes, and their nearest common DOM ancestor is `.sim-content`. */}
				{createPortal(
					<>
						{tabs.map(tab => (
							// `keepMounted`: every pane is built once and three of them read the live document, so none may be unmounted.
							<Tabs.Panel
								key={tab.id}
								value={tab.id}
								keepMounted
								className="sim-tab-panel max-w-full grow pt-(--spacing-gutter) opacity-100 [transition:var(--transition-fade)] data-[starting-style]:opacity-0 max-lg:pt-[calc(var(--spacing-gutter-sm)*2)]"
								data-testid="sim-tab-panel">
								{tab.children}
							</Tabs.Panel>
						))}
					</>,
					panes,
				)}
			</Tabs.Root>
		</TabActivationContext>
	);
};
