// The two halves this panel is built on, and one race that only a unit test can reach.
//
// Progress is refs and DOM writes; only a stage change renders. `sim-progress.mjs` drives the real
// thing in a browser, but it waits for text to appear, so it passes on tick two and can never see
// that tick one's numbers were dropped — that gap is what the "same commit" case below covers.
import { SimHostProvider } from '@sim/context/SimHostContext';
import type { IndividualSimHost, SimWarning } from '@sim/sim_host';
import { ProgressMetrics } from '@generated/proto/api';
import { act, render } from '@testing-library/react';
import { Profiler } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { SimResultsManager } from '../../model/results_manager';
import { WarningsRegistry } from '../../model/warnings';
import { ResultsPanelStore } from './results_panel_store';
import { SimResultsPanel } from './SimResultsPanel';

// The summary needs a whole SimResult; SimResultSummary.test.tsx is where it is asserted. What is
// under test here is that the content zone renders it and nothing else.
vi.mock('./SimResultSummary', () => ({ SimResultSummary: () => <div className="sim-result-summary-root" /> }));

const host = (disabled = false, isHealingSpec = false) =>
	({
		disabled,
		player: { getPlayerSpec: () => ({ isHealingSpec }) },
		// The warnings only read the registry once the sim reports ready; every case here is a loaded sim.
		sim: { waitForInit: () => Promise.resolve() },
	}) as unknown as IndividualSimHost<any>;

const progress = (dps: number, hps: number, completed: number, total: number, presimRunning = false) =>
	ProgressMetrics.create({ dps, hps, completedIterations: completed, totalIterations: total, presimRunning });

const mount = (panel: ResultsPanelStore, warnings: WarningsRegistry, disabled = false, isHealingSpec = false, results: SimResultsManager | null = null) => {
	const commits = vi.fn();
	const view = render(
		<SimHostProvider host={host(disabled, isHealingSpec)}>
			<Profiler id="panel" onRender={commits}>
				<SimResultsPanel panel={panel} warnings={warnings} results={results} />
			</Profiler>
		</SimHostProvider>,
	);
	return { commits, view };
};

const zone = (view: ReturnType<typeof render>, selector: string) => view.container.querySelector<HTMLElement>(selector)!;
const shown = (view: ReturnType<typeof render>, selector: string) => !zone(view, selector).hidden;
const zones = (view: ReturnType<typeof render>) => ({
	pending: shown(view, '.results-pending'),
	content: shown(view, '.results-content'),
	buttons: shown(view, '.button-zone'),
});

let panel: ResultsPanelStore;
let warnings: WarningsRegistry;

// The test i18n stub echoes the key, so these assertions pin the key rather than the copy.
const ITERATIONS = 'sidebar.results.progress.iterations_complete';

const staticWarning = (getContent: () => string | Array<string>): SimWarning => ({ updateOn: () => () => {}, getContent });

describe('SimResultsPanel', () => {
	beforeEach(() => {
		panel = new ResultsPanelStore();
		warnings = new WarningsRegistry();
	});

	it('renders the four zones in order, with every run zone hidden at construction', () => {
		const { view } = mount(panel, warnings);
		const viewer = zone(view, '.results-viewer');

		expect([...viewer.children].map(el => el.className)).toEqual([
			'results-pending',
			'results-content',
			'button-zone text-center',
			'warning-zone text-center',
		]);
		expect(zones(view)).toEqual({ pending: false, content: false, buttons: false });
		expect(shown(view, '.warning-zone')).toBe(true);
		expect(viewer.querySelector('.results-pending .loader')).not.toBeNull();
	});

	it('follows the visibility table through the handle', () => {
		const { view } = mount(panel, warnings);

		act(() => panel.setPending());
		expect(zones(view)).toEqual({ pending: true, content: false, buttons: false });

		// The button zone is its own axis: adding the Stop button does not touch pending or content.
		act(() => panel.addAbortButton(() => {}));
		expect(zones(view)).toEqual({ pending: true, content: false, buttons: true });

		act(() => panel.setProgress(progress(1, 2, 3, 4)));
		expect(zones(view)).toEqual({ pending: true, content: false, buttons: true });
		expect(view.container.querySelector('.results-pending .results-sim')).not.toBeNull();
		expect(view.container.querySelector('.results-pending .loader')).toBeNull();

		act(() => panel.showResult());
		expect(zones(view)).toEqual({ pending: false, content: true, buttons: true });

		// `hideAll` takes the Stop button's zone down with the other two, before it is ever removed.
		act(() => panel.hideAll());
		expect(zones(view)).toEqual({ pending: false, content: false, buttons: false });
		expect(view.container.querySelector('.button-zone button')).not.toBeNull();

		act(() => panel.removeAbortButton());
		expect(view.container.querySelector('.button-zone button')).toBeNull();
	});

	it('renders the finished run into the content zone, and leaves it empty without a manager', () => {
		expect(zone(mount(panel, warnings).view, '.results-content').childNodes.length).toBe(0);

		const { view } = mount(panel, warnings, false, false, {} as SimResultsManager);
		expect(zone(view, '.results-content > .sim-result-summary-root')).not.toBeNull();
	});

	it('puts the first tick on screen in the same commit that mounts the block', () => {
		const { view } = mount(panel, warnings);
		act(() => panel.setPending());

		// One call, carrying both the stage change and the first numbers — the shape every transport
		// delivers. Mutation check: drop `SimProgress`'s `latestProgress` read and this reads empty.
		act(() => panel.setProgress(progress(1234.5678, 22.5, 10, 1000)));

		expect(zone(view, '.results-sim-dps .topline-result-avg').textContent).toBe('1234.57');
		expect(zone(view, '.results-sim-hps .topline-result-avg').textContent).toBe('22.50');
		expect(zone(view, '.results-sim').lastElementChild!.textContent).toBe(`10 / 1000${ITERATIONS}`);
	});

	it('writes later ticks without rendering', () => {
		const { view, commits } = mount(panel, warnings);
		act(() => panel.setPending());
		act(() => panel.setProgress(progress(1, 1, 1, 100)));
		const afterMount = commits.mock.calls.length;

		for (let i = 2; i <= 100; i++) act(() => panel.setProgress(progress(i, i * 2, i, 100)));

		expect(zone(view, '.results-sim-dps .topline-result-avg').textContent).toBe('100.00');
		expect(zone(view, '.results-sim-hps .topline-result-avg').textContent).toBe('200.00');
		expect(zone(view, '.results-sim').lastElementChild!.textContent).toBe(`100 / 100${ITERATIONS}`);
		expect(commits.mock.calls.length).toBe(afterMount);

		// And a stage change is still exactly one commit.
		act(() => panel.showResult());
		expect(commits.mock.calls.length).toBe(afterMount + 1);
	});

	it('shows the presim caption instead of the counter', () => {
		const { view } = mount(panel, warnings);
		act(() => panel.setPending());
		act(() => panel.setProgress(progress(0, 0, 0, 0, true)));

		expect(zone(view, '.results-sim').lastElementChild!.textContent).toBe(`sidebar.results.progress.presim_running${ITERATIONS}`);
	});

	it('commits the stage before the caller returns, so a same-task read sees it', () => {
		const { view } = mount(panel, warnings);
		// No `act`: this is the run action's own click handler, which reads the DOM back before its
		// first await. Without `flushSync` in the store the commit lands a microtask later.
		panel.setPending();
		expect(zones(view).pending).toBe(true);
	});

	it('disables and relabels the Stop button before calling the handler', () => {
		const seen: Array<{ label: string; disabled: boolean }> = [];
		const { view } = mount(panel, warnings);
		act(() =>
			panel.addAbortButton(() => {
				const button = view.container.querySelector<HTMLButtonElement>('.button-zone button')!;
				seen.push({ label: button.textContent!.trim(), disabled: button.disabled });
			}),
		);

		const button = view.container.querySelector<HTMLButtonElement>('.button-zone button')!;
		expect(button.getAttribute('type')).toBe('button');
		expect(button.textContent!.trim()).toBe('sidebar.results.stop');

		act(() => button.click());
		expect(seen).toEqual([{ label: 'sidebar.results.stopping', disabled: true }]);
	});

	it('follows the warnings registry in both directions and lists one entry each', async () => {
		let active = '';
		let notify = () => {};
		warnings.add({
			updateOn: listener => {
				notify = listener;
				return () => {};
			},
			getContent: () => active,
		});
		const { view } = mount(panel, warnings);
		const item = zone(view, '.warning-zone .sim-toolbar-item');
		expect(item.classList.contains('hide')).toBe(true);

		// The sim reports ready a microtask after mount, and the warnings say nothing until it does.
		await act(async () => {});

		act(() => {
			active = 'Unspent talent points';
			notify();
		});
		expect(item.classList.contains('hide')).toBe(false);

		act(() => {
			active = '';
			notify();
		});
		expect(item.classList.contains('hide')).toBe(true);
	});

	it('names the warning trigger and draws its glyph through Icon', () => {
		warnings.add(staticWarning(() => 'a warning'));
		const { view } = mount(panel, warnings);
		const trigger = zone(view, '.warning-zone button');

		expect(trigger.getAttribute('aria-label')).toBeTruthy();
		expect(trigger.querySelector('i')!.className).toBe('fas fa-triangle-exclamation fa-3x');
	});

	it('renders the unlaunched notice after the four zones, and only for a disabled spec', () => {
		const launched = mount(panel, warnings, false);
		expect(launched.view.container.querySelector('.sim-ui-unlaunched-container')).toBeNull();
		launched.view.unmount();

		const { view } = mount(new ResultsPanelStore(), new WarningsRegistry(), true, true);
		const viewer = zone(view, '.results-viewer');
		expect(viewer.lastElementChild!.classList.contains('sim-ui-unlaunched-container')).toBe(true);
		expect(viewer.querySelectorAll('.sim-ui-unlaunched-container p').length).toBe(2);
	});

	it('drops its subscriptions and its tooltip on unmount', () => {
		warnings.add(staticWarning(() => 'a warning'));
		const { view } = mount(panel, warnings);
		view.unmount();

		expect(document.querySelector('.sim-tooltip')).toBeNull();
		// A late tick from a run that outlived the panel must not throw.
		expect(() => panel.setProgress(progress(1, 1, 1, 1))).not.toThrow();
	});
});
