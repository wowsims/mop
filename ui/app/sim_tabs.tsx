// Top-level tab behaviour, owned by React.
//
// Bootstrap's tab plugin used to do this, driven by `data-bs-toggle="tab"` delegated on document.
// Those attributes are gone from the top-level tabs (the detailed-results tabs *inside* the results
// pane are a separate, still-Bootstrap set), so this component is the only thing toggling them.
//
// It renders null on purpose. The list and pane elements are still built imperatively by SimTab and
// SimUI.addTab, so React cannot render them as children yet — what it owns here is which elements
// are in each container, in what order, and which one is active. When those components become React
// the entries become props and this collapses into ordinary rendering.
import type { SimTabRegistry } from '@ui-kit/tab_registry';
import { useEffect, useLayoutEffect, useRef, useSyncExternalStore } from 'react';

export interface SimTabsProps {
	registry: SimTabRegistry;
	/** The header's `<ul class="sim-tabs">`. */
	strip: HTMLElement;
	/** The sim's `<main class="sim-main tab-content">`. */
	panes: HTMLElement;
}

export function SimTabs({ registry, strip, panes }: SimTabsProps) {
	const entries = useSyncExternalStore(registry.subscribe, registry.getEntries);
	const activeId = useSyncExternalStore(registry.subscribe, registry.getActiveId);

	// Order. The registry puts a pane in the page as its tab is created, because tab contents are
	// built in the constructor and some of them read the live document. This reasserts the registry's
	// order over whatever that produced, and does nothing when the two already agree — appendChild
	// would otherwise move nodes on every attach. Both containers hold tab elements and nothing else,
	// so comparing the full child list is the same as comparing the tabs.
	useLayoutEffect(() => {
		const reorder = (container: HTMLElement, wanted: HTMLElement[]) => {
			const current = [...container.children];
			if (wanted.length === current.length && wanted.every((el, i) => el === current[i])) return;
			wanted.forEach(el => container.appendChild(el));
		};
		reorder(
			strip,
			entries.map(entry => entry.navItem),
		);
		reorder(
			panes,
			entries.map(entry => entry.pane),
		);
	}, [entries, strip, panes]);

	useLayoutEffect(() => {
		const onClick = (entry: (typeof entries)[number]) => () => registry.activate(entry.id);
		const handlers = entries.map(entry => {
			const handler = onClick(entry);
			entry.navLink.addEventListener('click', handler);
			return () => entry.navLink.removeEventListener('click', handler);
		});
		return () => handlers.forEach(remove => remove());
	}, [entries, registry]);

	// `active` controls display, `show` controls opacity.
	useLayoutEffect(() => {
		for (const entry of entries) {
			const isActive = entry.id === activeId;
			entry.navLink.classList.toggle('active', isActive);
			entry.navLink.setAttribute('aria-selected', String(isActive));
			entry.pane.classList.toggle('active', isActive);
			if (!isActive) entry.pane.classList.remove('show');
		}
	}, [entries, activeId]);

	// Bootstrap sets `active` first and `show` on the next frame *when switching*, so its .15s fade
	// actually runs; on the initial render it sets both at once, since there is nothing to fade from.
	// Waiting a frame there would leave the open pane at opacity 0 for a frame on every page load.
	const shownId = useRef<string | null>(null);
	useEffect(() => {
		const reveal = () => {
			for (const entry of entries) entry.pane.classList.toggle('show', entry.id === activeId);
		};
		const isSwitch = shownId.current !== null && shownId.current !== activeId;
		shownId.current = activeId;
		if (!isSwitch) {
			reveal();
			return;
		}
		const frame = requestAnimationFrame(reveal);
		return () => cancelAnimationFrame(frame);
	}, [entries, activeId]);

	return null;
}
