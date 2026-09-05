// Top-level tab behaviour, owned by React — everything Bootstrap's tab plugin used to do. Renders
// null: the elements are still built by SimTab and SimUI.addTab, so what React owns here is their
// order and active state, not their markup.
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

	// Reasserts the registry's order over what attaching produced, and does nothing when they already
	// agree — appendChild would otherwise move nodes on every attach. Both containers hold only tabs.
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
			// Roving tabindex, as Bootstrap set it: no attribute on the active link.
			if (isActive) entry.navLink.removeAttribute('tabindex');
			else entry.navLink.setAttribute('tabindex', '-1');
			entry.pane.classList.toggle('active', isActive);
			if (!isActive) entry.pane.classList.remove('show');
		}
	}, [entries, activeId]);

	// Arrow/Home/End navigation, wrapping, focus following the selection — Bootstrap's `_keydown`.
	// With a roving tabindex these are the only way to reach the other tabs from the keyboard.
	useLayoutEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			const from = entries.findIndex(entry => entry.navLink === event.target);
			if (from < 0) return;
			const offset = { ArrowLeft: -1, ArrowUp: -1, ArrowRight: 1, ArrowDown: 1 }[event.key];
			const to = offset ? (from + offset + entries.length) % entries.length : event.key === 'Home' ? 0 : event.key === 'End' ? entries.length - 1 : -1;
			if (to < 0) return;
			event.stopPropagation();
			event.preventDefault();
			entries[to].navLink.focus({ preventScroll: true });
			registry.activate(entries[to].id);
		};
		strip.addEventListener('keydown', onKeyDown);
		return () => strip.removeEventListener('keydown', onKeyDown);
	}, [entries, registry, strip]);

	// `active` before `show` on a switch, so the .15s fade runs; both at once on the first render,
	// where waiting a frame would blank the open pane for a frame on every page load.
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
