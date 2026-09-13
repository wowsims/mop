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

	// Base UI fires `onValueChange` for a user interaction only, so a pane opening a sibling tab
	// reports the page view through here instead.
	const activate = (id: string) => {
		setActiveId(id);
		trackPageView(tabs.find(tab => tab.id === id)?.title ?? id, id);
	};

	return (
		<TabActivationContext value={activate}>
			<Tabs.Root className="contents" value={value} onValueChange={next => activate(String(next))}>
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
								className="max-w-full grow pt-6 opacity-100 [transition:var(--transition-fade)] data-[starting-style]:opacity-0 max-lg:pt-4"
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
