import './SimTabs.scss';

import { Tabs } from '@base-ui/react/tabs';
import type { SimTabRegistry } from '@ui-kit/tab_registry';
import clsx from 'clsx';
import { useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';

import { trackPageView } from '../tracking/analytics';

export interface SimTabsProps {
	registry: SimTabRegistry;
	panes: HTMLElement;
}

export const SimTabs = ({ registry, panes }: SimTabsProps) => {
	const entries = useSyncExternalStore(registry.subscribe, registry.getEntries);
	const activeId = useSyncExternalStore(registry.subscribe, registry.getActiveId);

	return (
		<Tabs.Root
			className="sim-tabs-root"
			value={activeId}
			onValueChange={value => {
				const id = String(value);
				registry.activate(id);
				trackPageView(entries.find(entry => entry.id === id)?.title ?? id, id);
			}}>
			<Tabs.List className="sim-tabs" activateOnFocus>
				{entries.map(entry => (
					<Tabs.Tab key={entry.id} value={entry.id} className={clsx('sim-tab-link', entry.id)}>
						{entry.title}
						{entry.badge && (
							<>
								{' ('}
								<span className="text-success">{entry.badge}</span>
								{')'}
							</>
						)}
					</Tabs.Tab>
				))}
			</Tabs.List>
			{/* The one portal the shell keeps: `Tabs.Root` has to be a React ancestor of both the strip and the panes, and their nearest common DOM ancestor is `.sim-content`. */}
			{createPortal(
				<>
					{entries.map(entry => (
						// `keepMounted`: every pane is built once and three of them read the live document, so none may be unmounted.
						<Tabs.Panel key={entry.id} value={entry.id} keepMounted className="sim-tab-panel">
							{entry.pane}
						</Tabs.Panel>
					))}
				</>,
				panes,
			)}
		</Tabs.Root>
	);
};
