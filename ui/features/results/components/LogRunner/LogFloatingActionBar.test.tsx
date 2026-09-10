import { act, fireEvent, render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { EMPTY_SUGGESTIONS } from '../../model/log/search/indexes';
import { LogFloatingActionBar } from './LogFloatingActionBar';
import type { IdentifiedSearchGroup } from './utils';

vi.mock('./LogSearchBar', () => ({ LogSearchBar: () => <div className="log-search-bar" /> }));

const observed: Array<{ callback: IntersectionObserverCallback; options?: IntersectionObserverInit }> = [];

beforeEach(() => {
	observed.length = 0;
	vi.stubGlobal(
		'IntersectionObserver',
		class {
			constructor(
				public callback: IntersectionObserverCallback,
				public options?: IntersectionObserverInit,
			) {
				observed.push({ callback, options });
			}
			observe() {}
			disconnect() {}
			unobserve() {}
			takeRecords() {
				return [];
			}
		},
	);
});

const group = (field: IdentifiedSearchGroup['field'], values: Array<string>, id = 0): IdentifiedSearchGroup => ({ id, field, join: 'or', values });

const mount = (groups: Array<IdentifiedSearchGroup>, onChange = vi.fn()) => ({
	onChange,
	...render(
		<LogFloatingActionBar groups={groups} suggestions={EMPTY_SUGGESTIONS} onChange={onChange}>
			<button type="button" className="log-export" />
		</LogFloatingActionBar>,
	),
});

const root = (container: HTMLElement) => container.querySelector<HTMLElement>('.log-floating-action-bar-root')!;
const toggle = (container: HTMLElement) => container.querySelector<HTMLButtonElement>('.log-fab-toggle')!;
const clear = (container: HTMLElement) => container.querySelector<HTMLButtonElement>('.log-fab-clear')!;
const panel = (container: HTMLElement) => container.querySelector<HTMLElement>('.log-fab-panel-inner')!;

describe('LogFloatingActionBar', () => {
	it('starts collapsed, with the drawer out of the tab order', () => {
		const { container } = mount([]);

		expect(root(container).dataset.expanded).toBe('false');
		expect(toggle(container).getAttribute('aria-expanded')).toBe('false');
		expect(panel(container).hasAttribute('inert')).toBe(true);
	});

	it('opens and closes on the toggle, and lets the drawer back into the tab order', () => {
		const { container } = mount([]);

		fireEvent.click(toggle(container));
		expect(root(container).dataset.expanded).toBe('true');
		expect(panel(container).hasAttribute('inert')).toBe(false);

		fireEvent.click(toggle(container));
		expect(root(container).dataset.expanded).toBe('false');
	});

	it('closes on Escape and puts focus back on the toggle', () => {
		const { container } = mount([]);
		fireEvent.click(toggle(container));

		fireEvent.keyDown(root(container), { key: 'Escape' });

		expect(root(container).dataset.expanded).toBe('false');
		expect(document.activeElement).toBe(toggle(container));
	});

	it('ignores Escape while it is already closed', () => {
		const { container } = mount([]);
		const before = document.activeElement;

		fireEvent.keyDown(root(container), { key: 'Escape' });

		expect(document.activeElement).toBe(before);
	});

	// A group with no values is not a filter yet, so it must not be counted or previewed.
	it('counts and previews only the groups that carry a value', () => {
		const { container } = mount([group('outcome', ['crit']), group('spell', [], 1)]);

		expect(container.querySelector('.log-fab-summary')!.textContent).toBe('results_tab.details.logs.floatingActionBar.active');
		expect(container.querySelector('.log-fab-preview')!.textContent).toBe('Outcome: Crit');
	});

	it('elides the preview past three filters', () => {
		const { container } = mount([0, 1, 2, 3].map(index => group('outcome', ['crit'], index)));

		expect(container.querySelector('.log-fab-preview')!.textContent).toBe('Outcome: Crit, Outcome: Crit, Outcome: Crit, …');
	});

	it('says there are no filters and hides Clear while nothing is picked', () => {
		const { container } = mount([group('spell', [])]);

		expect(container.querySelector('.log-fab-summary')!.textContent).toBe('results_tab.details.logs.floatingActionBar.none');
		expect(container.querySelector('.log-fab-preview')!.textContent).toBe('');
		expect(clear(container).hidden).toBe(true);
	});

	it('shows Clear once a filter exists, and empties every group with it', () => {
		const { container, onChange } = mount([group('outcome', ['crit'])]);
		expect(clear(container).hidden).toBe(false);

		fireEvent.click(clear(container));

		expect(onChange).toHaveBeenCalledWith([]);
	});

	it('renders its controls into the actions row', () => {
		const { container } = mount([]);

		expect(container.querySelector('.log-fab-actions > .log-fab-controls > .log-export')).not.toBeNull();
	});

	// Built inside a hidden tab, the ratio goes 0 -> pinned without ever passing through 1, so a
	// threshold of [1] alone never fires again.
	it('watches for the pin with both thresholds', () => {
		mount([]);

		expect(observed).toHaveLength(1);
		expect(observed[0].options).toEqual({ rootMargin: '0px 0px -1px 0px', threshold: [0, 1] });
	});

	describe('the pinned state', () => {
		const deliver = (container: HTMLElement, ratios: Array<number>, clientHeight = 48) => {
			const target = root(container);
			Object.defineProperty(target, 'clientHeight', { value: clientHeight, configurable: true });
			const records = ratios.map(intersectionRatio => ({ target, intersectionRatio })) as unknown as Array<IntersectionObserverEntry>;
			act(() => observed[0].callback(records, null as never));
		};

		it('pins the bar once it is clipped by the viewport edge', () => {
			const { container } = mount([]);

			deliver(container, [0.98]);

			expect(root(container).className).toContain('stuck');
		});

		it('lets go once the bar is fully in view again', () => {
			const { container } = mount([]);
			deliver(container, [0.98]);

			deliver(container, [1]);

			expect(root(container).className).not.toContain('stuck');
		});

		// A pane the tab switch closed has no box at all, and a ratio of 0 would otherwise read as
		// "clipped" and pin a bar nobody can see.
		it('stays unpinned while the pane it lives in is closed', () => {
			const { container } = mount([]);
			deliver(container, [0.98]);

			deliver(container, [0], 0);

			expect(root(container).className).not.toContain('stuck');
		});

		// One delivery can carry several records, oldest first. The list growing under a bar that was
		// already pinned produces exactly this pair, and reading the first leaves it unpinned for good
		// because nothing moves again to produce another record.
		it('reads the newest record in a delivery, not the oldest', () => {
			const { container } = mount([]);

			deliver(container, [1, 0.98]);

			expect(root(container).className).toContain('stuck');
		});
	});
});
