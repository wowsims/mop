// Top-level tab behaviour, owned by React — everything Bootstrap's tab plugin used to do, plus the
// strip itself. The panes are still built by SimTab and SimUI.addTab and attached by the registry
// (a tab's constructor reads the live document), so what React owns here is the nav markup, the
// order and the active state.
import type { SimTabRegistry } from '@ui-kit/tab_registry';
import clsx from 'clsx';
import { useCallback, useEffect, useLayoutEffect, useRef, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';

import { trackPageView } from '../tracking/analytics';

export interface SimTabsProps {
	registry: SimTabRegistry;
	/** The header's `<ul class="sim-tabs">`, built by the vanilla shell. */
	strip: HTMLElement;
	/** The sim's `<main class="sim-main tab-content">`. */
	panes: HTMLElement;
}

export const SimTabs = ({ registry, strip, panes }: SimTabsProps) => {
	const entries = useSyncExternalStore(registry.subscribe, registry.getEntries);
	const activeId = useSyncExternalStore(registry.subscribe, registry.getActiveId);

	// Keyed by tab id rather than read off the DOM: the keyboard handler needs to map an event target
	// back to an entry, and to move focus, and neither is worth an attribute in the markup.
	const links = useRef(new Map<string, HTMLElement>());
	const linkRef = useCallback(
		(id: string) => (element: HTMLElement | null) => {
			if (element) links.current.set(id, element);
			else links.current.delete(id);
		},
		[],
	);

	// Reasserts the registry's order over what attaching produced, and does nothing when they already
	// agree — appendChild would otherwise move nodes on every attach. The container holds only panes.
	useLayoutEffect(() => {
		const wanted = entries.map(entry => entry.pane);
		const current = [...panes.children];
		if (wanted.length === current.length && wanted.every((el, i) => el === current[i])) return;
		wanted.forEach(el => panes.appendChild(el));
	}, [entries, panes]);

	// `active` controls display, `show` controls opacity.
	useLayoutEffect(() => {
		for (const entry of entries) {
			const isActive = entry.id === activeId;
			entry.pane.classList.toggle('active', isActive);
			if (!isActive) entry.pane.classList.remove('show');
		}
	}, [entries, activeId]);

	// Arrow/Home/End navigation, wrapping, focus following the selection — Bootstrap's `_keydown`.
	// With a roving tabindex these are the only way to reach the other tabs from the keyboard.
	useLayoutEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			const from = entries.findIndex(entry => links.current.get(entry.id) === event.target);
			if (from < 0) return;
			const offset = { ArrowLeft: -1, ArrowUp: -1, ArrowRight: 1, ArrowDown: 1 }[event.key];
			const to = offset ? (from + offset + entries.length) % entries.length : event.key === 'Home' ? 0 : event.key === 'End' ? entries.length - 1 : -1;
			if (to < 0) return;
			event.stopPropagation();
			event.preventDefault();
			links.current.get(entries[to].id)?.focus({ preventScroll: true });
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

	return createPortal(
		entries.map(entry => {
			const isActive = entry.id === activeId;
			return (
				<li key={entry.id} className={`${entry.id} nav-item`} role="presentation" aria-controls={entry.ariaControlsOnItem ? entry.id : undefined}>
					<button
						ref={linkRef(entry.id)}
						className={clsx('nav-link', isActive && 'active')}
						type="button"
						role="tab"
						aria-selected={isActive}
						// Roving tabindex, as Bootstrap set it: no attribute on the active link.
						tabIndex={isActive ? undefined : -1}
						aria-controls={entry.ariaControlsOnItem ? undefined : entry.id}
						onClick={() => {
							registry.activate(entry.id);
							trackPageView(entry.title, entry.id);
						}}>
						{entry.title}
						{entry.badge && (
							<>
								{' ('}
								<span className="text-success">{entry.badge}</span>
								{')'}
							</>
						)}
					</button>
				</li>
			);
		}),
		strip,
	);
};
