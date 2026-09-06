import './SimTabs.scss';

import { Tabs } from '@base-ui/react/tabs';
import type { SimTabRegistry } from '@ui-kit/tab_registry';
import clsx from 'clsx';
import { useCallback, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';

import { trackPageView } from '../tracking/analytics';

export interface SimTabsProps {
	registry: SimTabRegistry;
	strip: HTMLElement;
	panes: HTMLElement;
}

export const SimTabs = ({ registry, strip, panes }: SimTabsProps) => {
	const entries = useSyncExternalStore(registry.subscribe, registry.getEntries);
	const activeId = useSyncExternalStore(registry.subscribe, registry.getActiveId);

	const adopt = useCallback(
		(pane: HTMLElement) => (panel: HTMLDivElement | null) => {
			if (panel && pane.parentElement !== panel) panel.appendChild(pane);
		},
		[],
	);

	return createPortal(
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
			{createPortal(
				<>
					{entries.map(entry => (
						// `keepMounted`: every pane is built once and three of them read the live document, so none may be unmounted.
						<Tabs.Panel key={entry.id} ref={adopt(entry.pane)} value={entry.id} keepMounted className="sim-tab-panel" />
					))}
				</>,
				panes,
			)}
		</Tabs.Root>,
		strip,
	);
};
