import { act, render } from '@testing-library/react';
import { SimTabRegistry } from '@ui-kit/tab_registry';
import { beforeEach, describe, expect, it } from 'vitest';

import { SimTabs } from './sim_tabs';

// Builds the two elements SimTab and SimUI.addTab hand to the registry.
function makeTab(id: string) {
	const navLink = document.createElement('button');
	navLink.className = 'nav-link';
	const navItem = document.createElement('li');
	navItem.className = `${id} nav-item`;
	navItem.appendChild(navLink);
	const pane = document.createElement('div');
	pane.id = id;
	pane.className = 'sim-tab tab-pane fade';
	return { id, title: id, navItem, navLink, pane };
}

let strip: HTMLElement;
let panes: HTMLElement;
let registry: SimTabRegistry;

const flushFrame = async () => {
	await act(async () => {
		await new Promise(resolve => requestAnimationFrame(() => resolve(null)));
	});
};

const renderTabs = () => render(<SimTabs registry={registry} strip={strip} panes={panes} />);

beforeEach(() => {
	strip = document.createElement('ul');
	panes = document.createElement('main');
	registry = new SimTabRegistry(strip, panes);
});

describe('SimTabs', () => {
	it('appends each registered tab to the strip and the pane container, in registration order', () => {
		['gear-tab', 'settings-tab', 'talents-tab'].forEach(id => registry.attach(makeTab(id)));
		renderTabs();
		expect([...strip.children].map(el => el.className)).toEqual(['gear-tab nav-item', 'settings-tab nav-item', 'talents-tab nav-item']);
		expect([...panes.children].map(el => el.id)).toEqual(['gear-tab', 'settings-tab', 'talents-tab']);
	});

	it('opens the first registered tab, which is what decides the tab open on load', async () => {
		['gear-tab', 'settings-tab'].forEach(id => registry.attach(makeTab(id)));
		renderTabs();
		await flushFrame();
		expect(panes.querySelectorAll('.tab-pane.active.show')).toHaveLength(1);
		expect(panes.querySelector('.tab-pane.active')!.id).toBe('gear-tab');
		expect(strip.querySelectorAll('.nav-link.active')).toHaveLength(1);
	});

	it('shows the tab open on load in the same frame, since there is nothing to fade from', () => {
		['gear-tab', 'settings-tab'].forEach(id => registry.attach(makeTab(id)));
		// `render` flushes effects but not the animation frame one of them can schedule, so a pane that
		// only gains `show` on the next frame would be at opacity 0 here — a flash on every page load.
		renderTabs();
		const pane = panes.querySelector<HTMLElement>('#gear-tab')!;
		expect(pane.classList.contains('active')).toBe(true);
		expect(pane.classList.contains('show')).toBe(true);
	});

	it('activates exactly one tab per click, and marks it selected', async () => {
		['gear-tab', 'settings-tab', 'talents-tab'].forEach(id => registry.attach(makeTab(id)));
		renderTabs();

		const settingsLink = strip.querySelector<HTMLElement>('.settings-tab .nav-link')!;
		await act(async () => {
			settingsLink.click();
		});
		await flushFrame();

		expect(panes.querySelectorAll('.tab-pane.active.show')).toHaveLength(1);
		expect(panes.querySelector('.tab-pane.active')!.id).toBe('settings-tab');
		expect(strip.querySelectorAll('.nav-link.active')).toHaveLength(1);
		expect(settingsLink.getAttribute('aria-selected')).toBe('true');
		expect(strip.querySelector<HTMLElement>('.gear-tab .nav-link')!.getAttribute('aria-selected')).toBe('false');
	});

	it('adds `active` before `show` when switching, so the fade still runs', async () => {
		['gear-tab', 'settings-tab'].forEach(id => registry.attach(makeTab(id)));
		renderTabs();
		await flushFrame();

		// Synchronous act flushes the effects but not the animation frame they schedule, which is
		// exactly the window this test is about.
		act(() => {
			strip.querySelector<HTMLElement>('.settings-tab .nav-link')!.click();
		});
		const pane = panes.querySelector<HTMLElement>('#settings-tab')!;
		// Bootstrap sequenced these across two frames; collapsing them would make tabs snap.
		expect(pane.classList.contains('active')).toBe(true);
		expect(pane.classList.contains('show')).toBe(false);
		await flushFrame();
		expect(pane.classList.contains('show')).toBe(true);
	});

	it('activates by identifier, which is how the bulk results renderer returns to the gear tab', async () => {
		['gear-tab', 'settings-tab'].forEach(id => registry.attach(makeTab(id)));
		renderTabs();
		await act(async () => {
			registry.activate('settings-tab');
		});
		await flushFrame();
		expect(panes.querySelector('.tab-pane.active')!.id).toBe('settings-tab');

		await act(async () => {
			registry.activate('gear-tab');
		});
		await flushFrame();
		expect(panes.querySelector('.tab-pane.active')!.id).toBe('gear-tab');
	});

	it('places a tab registered after mount without disturbing the active one', async () => {
		['gear-tab', 'settings-tab'].forEach(id => registry.attach(makeTab(id)));
		renderTabs();
		await act(async () => {
			registry.attach(makeTab('bulk-tab'));
		});
		await flushFrame();
		expect([...panes.children].map(el => el.id)).toEqual(['gear-tab', 'settings-tab', 'bulk-tab']);
		expect(panes.querySelector('.tab-pane.active')!.id).toBe('gear-tab');
		expect(panes.querySelectorAll('.tab-pane.active.show')).toHaveLength(1);
	});

	it('ignores activation of an unknown tab', async () => {
		registry.attach(makeTab('gear-tab'));
		renderTabs();
		await act(async () => {
			registry.activate('nope');
		});
		await flushFrame();
		expect(panes.querySelector('.tab-pane.active')!.id).toBe('gear-tab');
	});
});
