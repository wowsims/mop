import { SimHostProvider } from '@sim/context/SimHostContext';
import { Emitter } from '@sim/state/events';
import { createSimStore } from '@sim/state/sim_store';
import { fireEvent, render, waitFor } from '@testing-library/react';
import { act } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ResultChannel } from '../../model/result_channel';
import type { SimResultData } from '../../model/result_data';

// The picker is `UnitPicker`'s test to cover; what this pane owns is the selection, so the filter is
// reduced to a button that reports one. Everything else in the module — `ALL_UNITS`, `hasTarget`,
// `simResultFilter` — is the real thing.
vi.mock('../ResultsFilter', async importOriginal => ({
	...(await importOriginal<typeof import('../ResultsFilter')>()),
	ResultsFilter: ({ target, onTargetChange }: { target: number; onTargetChange: (target: number) => void }) => (
		<button type="button" className="results-filter-root" data-target={target} onClick={() => onTargetChange(1)} />
	),
}));
// `updateResults` builds one of these per run; the only thing read off it here is the target list
// the filter is validated against.
const run = vi.hoisted(() => ({ targets: 3 }));
vi.mock('@sim/proto/sim_result', async importOriginal => ({
	...(await importOriginal<typeof import('@sim/proto/sim_result')>()),
	SimResult: { fromProto: () => Promise.resolve({ getTargets: () => Array.from({ length: run.targets }, (_, index) => ({ index })) }) },
}));

// Every pane below is React now, so they are prop readers rather than islands: what this pane owes
// each is `active`, which is what their own deferral is built on.
const panes = vi.hoisted(() => ({ log: [] as Array<boolean>, timeline: [] as Array<boolean>, replay: [] as Array<boolean> }));
vi.mock('../CombatReplay', () => ({
	CombatReplay: ({ active }: { active: boolean }) => {
		panes.replay.push(active);
		return <div className="combat-replay-root" />;
	},
}));
vi.mock('../LogRunner', () => ({
	LogRunner: ({ active }: { active: boolean }) => {
		panes.log.push(active);
		return <div className="log-runner-root" />;
	},
}));
vi.mock('../Timeline', () => ({
	Timeline: ({ active }: { active: boolean }) => {
		panes.timeline.push(active);
		return <div className="timeline-root" />;
	},
}));

vi.mock('../ToplineResults', () => ({ ToplineResults: () => <div className="topline-results-root" /> }));
vi.mock('../DpsHistogram', () => ({ DpsHistogram: () => <div className="dps-histogram-root" /> }));
vi.mock('../DamageMetricsTable', () => ({ DamageMetricsTable: () => <div className="damage-metrics-root" /> }));
vi.mock('../HealingMetricsTable', () => ({ HealingMetricsTable: () => <div className="healing-metrics-root" /> }));
vi.mock('../DtpsMetricsTable', () => ({ DtpsMetricsTable: () => <div className="dtps-metrics-root" /> }));
vi.mock('../CastMetricsTable', () => ({ CastMetricsTable: () => <div className="cast-metrics-root" /> }));
vi.mock('../ResourceMetricsTable', () => ({ ResourceMetricsTable: () => <div className="resource-metrics-root" /> }));
vi.mock('../AuraMetricsTable', () => ({
	AuraMetricsTable: ({ useDebuffs }: { useDebuffs: boolean }) => <div className={useDebuffs ? 'debuff-metrics-root' : 'buff-metrics-root'} />,
}));

const { DetailedResults } = await import('./DetailedResults');

const metrics = { damage: true, threat: false, healing: false, experimental: false };
let resultChannel: ResultChannel;
let currentChangeEmitter: Emitter<void>;

const makeHost = () => {
	const sim = {
		store: createSimStore(),
		getShowDamageMetrics: () => metrics.damage,
		getShowThreatMetrics: () => metrics.threat,
		getShowHealingMetrics: () => metrics.healing,
		getShowExperimental: () => metrics.experimental,
		getFixedRngSeed: () => 0,
		setFixedRngSeed: () => {},
	};
	return {
		sim,
		resultChannel,
		player: { secondaryResource: null },
		simHeader: { rootElem: document.createElement('div') },
		disabled: false,
		runSingleIteration: () => Promise.resolve(undefined),
	} as never;
};

let runData: unknown = null;

const renderPane = () =>
	render(
		<SimHostProvider host={makeHost()}>
			<DetailedResults resultsManager={{ currentChangeEmitter, getRunData: () => runData } as never} makeLogExporter={() => ({ open: () => {} })} />
		</SimHostProvider>,
	);

const filterButton = (container: HTMLElement) => container.querySelector<HTMLButtonElement>('.results-filter-root')!;

const tabButton = (container: HTMLElement, tabId: string) => container.querySelector<HTMLButtonElement>(`.dr-toolbar .nav-link[aria-controls=${tabId}]`)!;

beforeEach(() => {
	panes.log.length = 0;
	panes.timeline.length = 0;
	panes.replay.length = 0;
	resultChannel = new ResultChannel();
	currentChangeEmitter = new Emitter<void>();
	runData = null;
	run.targets = 3;
	metrics.damage = true;
	metrics.threat = false;
	metrics.healing = false;
	metrics.experimental = false;
});

describe('DetailedResults', () => {
	it('renders the ten tabs with the damage tab selected', () => {
		const { container } = renderPane();
		const buttons = [...container.querySelectorAll<HTMLButtonElement>('.dr-toolbar .nav-link')];
		expect(buttons).toHaveLength(10);
		expect(buttons.map(button => button.getAttribute('aria-controls'))).toEqual([
			'damageTab',
			'healingTab',
			'damageTakenTab',
			'buffsTab',
			'debuffsTab',
			'castsTab',
			'resourcesTab',
			'timelineTab',
			'replayTab',
			'logTab',
		]);
		expect(buttons.filter(button => button.getAttribute('aria-selected') === 'true')).toHaveLength(1);
		expect(buttons[0].className).toBe('nav-link active');
		expect(buttons[0].tabIndex).toBe(0);
		expect(buttons[1].tabIndex).toBe(-1);
		expect(buttons.every(button => button.getAttribute('type') === 'button')).toBe(true);
	});

	it('opens the damage pane and leaves the other nine faded out', () => {
		const { container } = renderPane();
		expect(container.querySelector('#damageTab')!.className).toBe('tab-pane dr-tab-content fade damage-content active show');
		expect(container.querySelector('#logTab')!.className).toBe('tab-pane dr-tab-content fade log-content');
		expect(container.querySelectorAll('.tab-content > .tab-pane.active')).toHaveLength(2);
		expect(container.querySelector('#noResultsTab')!.className).toBe('tab-pane dr-tab-content fade active show');
	});

	it('holds every ported metrics table in the container the vanilla pane built for it', () => {
		const { container } = renderPane();
		expect(container.querySelectorAll('#damageTab .damage-metrics > .damage-metrics-root')).toHaveLength(1);
		expect(container.querySelectorAll('#healingTab .healing-spell-metrics > .healing-metrics-root')).toHaveLength(1);
		expect(container.querySelectorAll('#damageTakenTab .dtps-metrics > .dtps-metrics-root')).toHaveLength(1);
		expect(container.querySelectorAll('#castsTab .cast-metrics > .cast-metrics-root')).toHaveLength(1);
		expect(container.querySelectorAll('#buffsTab .buff-aura-metrics > .buff-metrics-root')).toHaveLength(1);
		expect(container.querySelectorAll('#debuffsTab .debuff-aura-metrics > .debuff-metrics-root')).toHaveLength(1);
		expect(container.querySelectorAll('#resourcesTab .resource-metrics > .resource-metrics-root')).toHaveLength(1);
		expect(container.querySelectorAll('.dr-row.topline-results > .topline-results-root')).toHaveLength(3);
		expect(container.querySelectorAll('#damageTab .dr-row.dps-histogram > .dps-histogram-root')).toHaveLength(1);
	});

	it('keeps each pane in the container its island was built into', () => {
		const { container } = renderPane();
		expect(container.querySelectorAll('.dr-toolbar > .results-filter > .results-filter-root')).toHaveLength(1);
		expect(container.querySelectorAll('#logTab .dr-row > .log > .log-runner-root')).toHaveLength(1);
		expect(container.querySelectorAll('#timelineTab .dr-row > .timeline > .timeline-root')).toHaveLength(1);
		expect(container.querySelectorAll('#replayTab .dr-row > .combat-replay > .combat-replay-root')).toHaveLength(1);
	});

	it('drops dr-no-results once a result reaches the channel', () => {
		const { container } = renderPane();
		expect(container.querySelector('.dr-root')!.className).toBe('dr-root dr-no-results');
		act(() => resultChannel.emit({ result: {}, filter: {} } as SimResultData));
		expect(container.querySelector('.dr-root')!.className).toBe('dr-root');
	});

	it('moves active on the click and show a frame later', async () => {
		const { container } = renderPane();
		fireEvent.click(tabButton(container, 'timelineTab'));
		expect(container.querySelector('#timelineTab')!.classList.contains('active')).toBe(true);
		expect(container.querySelector('#timelineTab')!.classList.contains('show')).toBe(false);
		expect(container.querySelector('#damageTab')!.className).toBe('tab-pane dr-tab-content fade damage-content');
		await waitFor(() => expect(container.querySelector('#timelineTab')!.classList.contains('show')).toBe(true));
	});

	// What `onTabShown` was to an island, `active` is to every pane that defers its work.
	it.each([
		['log', 'logTab'],
		['timeline', 'timelineTab'],
		['replay', 'replayTab'],
	] as const)('tells the %s pane whether its tab is the open one', (pane, tabId) => {
		const { container } = renderPane();
		expect(panes[pane].at(-1)).toBe(false);
		fireEvent.click(tabButton(container, tabId));
		expect(panes[pane].at(-1)).toBe(true);
		fireEvent.click(tabButton(container, 'damageTab'));
		expect(panes[pane].at(-1)).toBe(false);
	});

	it('walks the strip with the arrow keys, wrapping at both ends', () => {
		const { container } = renderPane();
		const strip = container.querySelector('.dr-toolbar .nav-tabs')!;
		fireEvent.keyDown(strip, { key: 'ArrowLeft' });
		expect(tabButton(container, 'logTab').getAttribute('aria-selected')).toBe('true');
		fireEvent.keyDown(strip, { key: 'ArrowRight' });
		expect(tabButton(container, 'damageTab').getAttribute('aria-selected')).toBe('true');
		fireEvent.keyDown(strip, { key: 'End' });
		expect(tabButton(container, 'logTab').getAttribute('aria-selected')).toBe('true');
		fireEvent.keyDown(strip, { key: 'Home' });
		expect(tabButton(container, 'damageTab').getAttribute('aria-selected')).toBe('true');
	});

	it('carries the metric-visibility classes the vanilla pane put on its root', () => {
		metrics.threat = true;
		metrics.experimental = true;
		const { container } = renderPane();
		expect(container.querySelector('.detailed-results-manager-root')!.className).toBe('detailed-results-manager-root hide-healing-metrics');
	});

	it('leaves the damage tab for healing when damage metrics are off', async () => {
		metrics.damage = false;
		metrics.healing = true;
		const { container } = renderPane();
		await waitFor(() => expect(container.querySelector('#healingTab')!.classList.contains('active')).toBe(true));
		expect(container.querySelector('#damageTab')!.classList.contains('active')).toBe(false);
		expect(tabButton(container, 'healingTab').getAttribute('aria-selected')).toBe('true');
	});

	it('re-emits the last run under a newly picked target', async () => {
		const emitted: Array<SimResultData | null> = [];
		resultChannel.on(value => emitted.push(value));
		runData = { run: { request: { requestId: 'run-1' } } };
		const { container } = renderPane();

		await act(async () => currentChangeEmitter.emit());
		expect(emitted).toHaveLength(1);
		expect(emitted[0]!.filter).toEqual({ target: null });

		await act(async () => {
			fireEvent.click(filterButton(container));
		});
		expect(emitted).toHaveLength(2);
		expect(emitted[1]!.filter).toEqual({ target: 1 });
		expect(filterButton(container).dataset.target).toBe('1');
	});

	it('emits nothing on its own before a target is picked', async () => {
		const emitted: Array<SimResultData | null> = [];
		resultChannel.on(value => emitted.push(value));
		runData = { run: { request: { requestId: 'run-1' } } };
		renderPane();

		await act(async () => currentChangeEmitter.emit());
		await act(async () => currentChangeEmitter.emit());
		expect(emitted).toHaveLength(2);
	});

	it('drops a selected target the next run no longer has, before that run is emitted', async () => {
		const emitted: Array<SimResultData | null> = [];
		resultChannel.on(value => emitted.push(value));
		runData = { run: { request: { requestId: 'run-1' } } };
		const { container } = renderPane();

		await act(async () => currentChangeEmitter.emit());
		await act(async () => {
			fireEvent.click(filterButton(container));
		});
		expect(emitted.at(-1)!.filter).toEqual({ target: 1 });

		run.targets = 1;
		runData = { run: { request: { requestId: 'run-2' } } };
		await act(async () => currentChangeEmitter.emit());

		expect(emitted.at(-1)!.filter).toEqual({ target: null });
		expect(filterButton(container).dataset.target).toBe('-1');
		// The reset rides on the run's own emit rather than queueing a second one.
		expect(emitted).toHaveLength(3);
	});

	it('keeps a selected target the next run still has', async () => {
		const emitted: Array<SimResultData | null> = [];
		resultChannel.on(value => emitted.push(value));
		runData = { run: { request: { requestId: 'run-1' } } };
		const { container } = renderPane();

		await act(async () => currentChangeEmitter.emit());
		await act(async () => {
			fireEvent.click(filterButton(container));
		});

		runData = { run: { request: { requestId: 'run-2' } } };
		await act(async () => currentChangeEmitter.emit());

		expect(emitted.at(-1)!.filter).toEqual({ target: 1 });
		expect(filterButton(container).dataset.target).toBe('1');
	});

	it('keeps the death button disabled until a run reports death seeds', async () => {
		const { container } = renderPane();
		const buttons = [...container.querySelectorAll<HTMLButtonElement>('.detailed-results-controls-div button')];
		expect(buttons.map(button => button.getAttribute('type'))).toEqual(['button', 'button']);
		expect(buttons[0].disabled).toBe(false);
		expect(buttons[1].disabled).toBe(true);
		await act(async () => {
			currentChangeEmitter.emit();
		});
		expect(buttons[1].disabled).toBe(true);
	});
});
