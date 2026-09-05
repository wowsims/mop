// The top-level tabs, owned by Base UI. React renders the strip and one panel per tab; the panes
// themselves are still built by SimTab and SimUI.addTab and attached by the registry, because a
// tab's constructor reads the live document — so each panel adopts its pane rather than being it.
//
// `Tabs.Panel` cannot be the pane in any case: it calls `useBaseUiId()` with no argument and
// registers the id it generated, so an `id` passed to it renders on the element but leaves every
// tab's `aria-controls` dangling. Adopting keeps `#<id>` on the SimTab root, which four stylesheets
// select on.
import './SimTabs.scss';

import { Tabs } from '@base-ui/react/tabs';
import type { SimTabRegistry } from '@ui-kit/tab_registry';
import clsx from 'clsx';
import { useCallback, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';

import { trackPageView } from '../tracking/analytics';

export interface SimTabsProps {
	registry: SimTabRegistry;
	/** The header's `<div class="sim-tabs-mount">`, built by the vanilla shell. */
	strip: HTMLElement;
	/** The sim's `<main class="sim-main">`. */
	panes: HTMLElement;
}

export const SimTabs = ({ registry, strip, panes }: SimTabsProps) => {
	const entries = useSyncExternalStore(registry.subscribe, registry.getEntries);
	const activeId = useSyncExternalStore(registry.subscribe, registry.getActiveId);

	// Each panel adopts its pane once. The pane is already in `.sim-main` — the registry put it there
	// before the tab's constructor ran — so this moves it one level down, into its panel.
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
						// `keepMounted`: every pane is built once and three of them read the live document,
						// so none may be unmounted. Hidden panels get a real `hidden` attribute.
						<Tabs.Panel key={entry.id} ref={adopt(entry.pane)} value={entry.id} keepMounted className="sim-tab-panel" />
					))}
				</>,
				panes,
			)}
		</Tabs.Root>,
		strip,
	);
};
