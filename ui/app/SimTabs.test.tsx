import { act, render } from '@testing-library/react';
import { SimTabRegistry } from '@ui-kit/tab_registry';
import { beforeEach, describe, expect, it } from 'vitest';

import { SimTabs } from './SimTabs';

// The pane is all SimTab and SimUI.addTab hand to the registry; the tab and the panel are React's.
const makeTab = (id: string) => {
	const pane = document.createElement('div');
	pane.id = id;
	pane.className = 'sim-tab';
	return { id, title: id, pane };
};

let strip: HTMLElement;
let panes: HTMLElement;
let registry: SimTabRegistry;

const renderTabs = () => render(<SimTabs registry={registry} strip={strip} panes={panes} />);

beforeEach(() => {
	document.body.innerHTML = '';
	strip = document.createElement('div');
	panes = document.createElement('main');
	// Attached, so focus() actually moves document.activeElement.
	document.body.append(strip, panes);
	registry = new SimTabRegistry(panes);
});

const press = (key: string) =>
	act(() => {
		(document.activeElement ?? strip).dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
	});

const tabs = () => [...strip.querySelectorAll<HTMLElement>('[role="tab"]')];
const tab = (id: string) => strip.querySelector<HTMLElement>(`.${id}`)!;
const panels = () => [...panes.querySelectorAll<HTMLElement>('[role="tabpanel"]')];
/** The pane inside the one panel that is not hidden. */
const openId = () => panels().find(panel => !panel.hasAttribute('hidden'))?.firstElementChild?.id ?? null;
const selectedIds = () =>
	tabs()
		.filter(el => el.hasAttribute('data-active'))
		.map(el => el.className.split(' ').pop()!);

describe('SimTabs', () => {
	it('renders one tab and one panel per registered tab, in registration order', () => {
		['gear-tab', 'settings-tab', 'talents-tab'].forEach(id => registry.attach(makeTab(id)));
		renderTabs();
		expect(tabs().map(el => el.textContent)).toEqual(['gear-tab', 'settings-tab', 'talents-tab']);
		// Each panel adopts its pane, so the id the stylesheets select on moves one level down.
		expect(panels().map(panel => panel.firstElementChild!.id)).toEqual(['gear-tab', 'settings-tab', 'talents-tab']);
	});

	it('keeps every panel mounted, because a pane is built once and may read the document', () => {
		['gear-tab', 'settings-tab', 'talents-tab'].forEach(id => registry.attach(makeTab(id)));
		renderTabs();
		expect(panels()).toHaveLength(3);
		expect(panes.querySelectorAll('.sim-tab')).toHaveLength(3);
		// Hidden rather than removed — `[hidden]` is what stops them showing.
		expect(panels().filter(panel => panel.hasAttribute('hidden'))).toHaveLength(2);
	});

	it('opens the first registered tab, which is what decides the tab open on load', () => {
		['gear-tab', 'settings-tab'].forEach(id => registry.attach(makeTab(id)));
		renderTabs();
		expect(openId()).toBe('gear-tab');
		expect(selectedIds()).toEqual(['gear-tab']);
	});

	it('does not fade the tab open on load, which would blank the page for the first frame', () => {
		['gear-tab', 'settings-tab'].forEach(id => registry.attach(makeTab(id)));
		renderTabs();
		const open = panels().find(panel => !panel.hasAttribute('hidden'))!;
		expect(open.hasAttribute('data-starting-style')).toBe(false);
	});

	it('activates exactly one tab per click, and marks it selected', async () => {
		['gear-tab', 'settings-tab', 'talents-tab'].forEach(id => registry.attach(makeTab(id)));
		renderTabs();

		await act(async () => {
			tab('settings-tab').click();
		});

		expect(openId()).toBe('settings-tab');
		expect(selectedIds()).toEqual(['settings-tab']);
		expect(tab('settings-tab').getAttribute('aria-selected')).toBe('true');
		expect(tab('gear-tab').getAttribute('aria-selected')).toBe('false');
	});

	it('keeps a roving tabindex, so Tab reaches the strip once and lands on the open tab', async () => {
		['gear-tab', 'settings-tab', 'talents-tab'].forEach(id => registry.attach(makeTab(id)));
		renderTabs();
		const stops = () =>
			tabs()
				.filter(el => el.tabIndex !== -1)
				.map(el => el.className.split(' ').pop());
		expect(stops()).toEqual(['gear-tab']);

		await act(async () => {
			registry.activate('talents-tab');
		});
		expect(stops()).toEqual(['talents-tab']);
	});

	// Arrow/Home/End navigation is Base UI's composite, and it does not drive under happy-dom — the
	// keys land but the roving focus never moves. `tools/react-migration/tabs-a11y.mjs` asserts the
	// whole sequence in a real browser, against the parent branch's, which is a stronger check than
	// this file could make anyway.

	it('leaves other keys alone, so typing still reaches the page', () => {
		['gear-tab', 'settings-tab'].forEach(id => registry.attach(makeTab(id)));
		renderTabs();
		tab('gear-tab').focus();
		press('a');
		expect(openId()).toBe('gear-tab');
	});

	it('activates by identifier, which is how the bulk results renderer returns to the gear tab', async () => {
		['gear-tab', 'settings-tab'].forEach(id => registry.attach(makeTab(id)));
		renderTabs();
		await act(async () => {
			registry.activate('settings-tab');
		});
		expect(openId()).toBe('settings-tab');

		await act(async () => {
			registry.activate('gear-tab');
		});
		expect(openId()).toBe('gear-tab');
	});

	it('places a tab registered after mount without disturbing the active one', async () => {
		['gear-tab', 'settings-tab'].forEach(id => registry.attach(makeTab(id)));
		renderTabs();
		await act(async () => {
			registry.attach(makeTab('bulk-tab'));
		});
		expect(panels().map(panel => panel.firstElementChild!.id)).toEqual(['gear-tab', 'settings-tab', 'bulk-tab']);
		expect(openId()).toBe('gear-tab');
	});

	it('ignores activation of an unknown tab', async () => {
		registry.attach(makeTab('gear-tab'));
		renderTabs();
		await act(async () => {
			registry.activate('nope');
		});
		expect(openId()).toBe('gear-tab');
	});
});
