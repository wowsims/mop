import { act, render } from '@testing-library/react';
import { useActivateTab } from '@ui-kit/tab_activation';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SimTabDef } from './SimTabDef';
import { SimTabs } from './SimTabs';

const trackPageView = vi.hoisted(() => vi.fn());
vi.mock('../tracking/analytics', () => ({ trackPageView }));

// How the bulk results renderer returns to the gear tab: a button inside one pane opening another.
const Activators = ({ ids }: { ids: string[] }) => {
	const activate = useActivateTab();
	return (
		<>
			{ids.map(id => (
				<button key={id} className={`go-${id}`} onClick={() => activate(id)} />
			))}
		</>
	);
};

// The pane is whatever the declaration wraps; the tab and the panel are React's.
const makeTab = (id: string, index: number, ids: string[]) => (
	<SimTabDef key={id} id={id} title={id}>
		<div id={id} className="sim-tab">
			{index === 0 && <Activators ids={ids} />}
		</div>
	</SimTabDef>
);

let strip: HTMLElement;
let panes: HTMLElement;

// The first pane gets a button per tab, plus one for an id no tab carries.
const declare = (ids: string[]) => ids.map((id, index) => makeTab(id, index, [...ids, 'nope']));

const renderTabs = (ids: string[], extra?: ReactNode) =>
	render(
		<SimTabs panes={panes}>
			{declare(ids)}
			{extra}
		</SimTabs>,
		{ container: strip },
	);

// Awaited: Base UI settles a panel's `hidden` on the microtask after the value changes.
const activate = (id: string) =>
	act(async () => {
		panes.querySelector<HTMLElement>(`.go-${id}`)?.click();
	});

beforeEach(() => {
	trackPageView.mockClear();
	document.body.innerHTML = '';
	strip = document.createElement('div');
	panes = document.createElement('main');
	// Attached, so focus() actually moves document.activeElement.
	document.body.append(strip, panes);
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
	it('renders one tab and one panel per declared tab, in declaration order', () => {
		renderTabs(['gear-tab', 'settings-tab', 'talents-tab']);
		expect(tabs().map(el => el.textContent)).toEqual(['gear-tab', 'settings-tab', 'talents-tab']);
		// Each panel wraps its pane, so the id the stylesheets select on sits one level down.
		expect(panels().map(panel => panel.firstElementChild!.id)).toEqual(['gear-tab', 'settings-tab', 'talents-tab']);
	});

	it('keeps every panel mounted, because a pane is built once and may read the document', () => {
		renderTabs(['gear-tab', 'settings-tab', 'talents-tab']);
		expect(panels()).toHaveLength(3);
		expect(panes.querySelectorAll('.sim-tab')).toHaveLength(3);
		// Hidden rather than removed — `[hidden]` is what stops them showing.
		expect(panels().filter(panel => panel.hasAttribute('hidden'))).toHaveLength(2);
	});

	it('opens the first declared tab, which is what decides the tab open on load', () => {
		renderTabs(['gear-tab', 'settings-tab']);
		expect(openId()).toBe('gear-tab');
		expect(selectedIds()).toEqual(['gear-tab']);
	});

	it('does not fade the tab open on load, which would blank the page for the first frame', () => {
		renderTabs(['gear-tab', 'settings-tab']);
		const open = panels().find(panel => !panel.hasAttribute('hidden'))!;
		expect(open.hasAttribute('data-starting-style')).toBe(false);
	});

	it('activates exactly one tab per click, and marks it selected', async () => {
		renderTabs(['gear-tab', 'settings-tab', 'talents-tab']);

		await act(async () => {
			tab('settings-tab').click();
		});

		expect(openId()).toBe('settings-tab');
		expect(selectedIds()).toEqual(['settings-tab']);
		expect(tab('settings-tab').getAttribute('aria-selected')).toBe('true');
		expect(tab('gear-tab').getAttribute('aria-selected')).toBe('false');
	});

	it('keeps a roving tabindex, so Tab reaches the strip once and lands on the open tab', async () => {
		renderTabs(['gear-tab', 'settings-tab', 'talents-tab']);
		const stops = () =>
			tabs()
				.filter(el => el.tabIndex !== -1)
				.map(el => el.className.split(' ').pop());
		expect(stops()).toEqual(['gear-tab']);

		await activate('talents-tab');
		expect(stops()).toEqual(['talents-tab']);
	});

	// Arrow/Home/End navigation is Base UI's composite, and it does not drive under happy-dom — the
	// keys land but the roving focus never moves. `tools/react-migration/tabs-a11y.mjs` asserts the
	// whole sequence in a real browser, against the parent branch's, which is a stronger check than
	// this file could make anyway.

	it('leaves other keys alone, so typing still reaches the page', () => {
		renderTabs(['gear-tab', 'settings-tab']);
		tab('gear-tab').focus();
		press('a');
		expect(openId()).toBe('gear-tab');
	});

	it('activates by identifier, which is how the bulk results renderer returns to the gear tab', async () => {
		renderTabs(['gear-tab', 'settings-tab']);
		await activate('settings-tab');
		expect(openId()).toBe('settings-tab');

		await activate('gear-tab');
		expect(openId()).toBe('gear-tab');
	});

	it('places a tab declared after mount without disturbing the active one', () => {
		const { rerender } = renderTabs(['gear-tab', 'settings-tab']);
		rerender(<SimTabs panes={panes}>{declare(['gear-tab', 'settings-tab', 'bulk-tab'])}</SimTabs>);
		expect(panels().map(panel => panel.firstElementChild!.id)).toEqual(['gear-tab', 'settings-tab', 'bulk-tab']);
		expect(openId()).toBe('gear-tab');
	});

	it('ignores activation of an unknown tab, rather than hiding every panel', async () => {
		renderTabs(['gear-tab', 'settings-tab']);
		await activate('nope');
		expect(openId()).toBe('gear-tab');
	});

	it('reports a page view for a programmatic activation, not only for a click on the strip', async () => {
		renderTabs(['gear-tab', 'settings-tab']);

		await act(async () => {
			tab('settings-tab').click();
		});
		expect(trackPageView).toHaveBeenLastCalledWith('settings-tab', 'settings-tab');

		await activate('gear-tab');
		expect(trackPageView).toHaveBeenLastCalledWith('gear-tab', 'gear-tab');
		expect(trackPageView).toHaveBeenCalledTimes(2);
	});

	it('reads declarations out of a conditional group, so an entry list can be gated', () => {
		renderTabs(['gear-tab'], <>{makeTab('bulk-tab', 1, [])}</>);
		expect(tabs().map(el => el.textContent)).toEqual(['gear-tab', 'bulk-tab']);
	});
});
