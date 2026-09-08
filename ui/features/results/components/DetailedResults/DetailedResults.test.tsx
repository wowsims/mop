import { SimHostProvider } from '@sim/context/SimHostContext';
import { Emitter } from '@sim/state/events';
import { createSimStore } from '@sim/state/sim_store';
import { fireEvent, render, waitFor } from '@testing-library/react';
import { act } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ResultChannel } from '../../model/result_channel';
import type { SimResultData } from '../../model/result_data';

const islands = vi.hoisted(() => {
	const records = new Map<string, { shown: number; hidden: number; stopped: number; parents: Array<HTMLElement> }>();
	const track = (name: string) => {
		let record = records.get(name);
		if (!record) {
			record = { shown: 0, hidden: 0, stopped: 0, parents: [] };
			records.set(name, record);
		}
		return record;
	};
	return { records, track };
});

const island = (name: string, rootCssClass: string) => async () => {
	const { Component } = await import('@ui-kit/component');
	return class extends Component {
		constructor(config: { parent: HTMLElement }) {
			super(config.parent, rootCssClass);
			islands.track(name).parents.push(config.parent);
		}
		onTabShown() {
			islands.track(name).shown++;
		}
		onTabHidden() {
			islands.track(name).hidden++;
		}
		stopPlayback() {
			islands.track(name).stopped++;
		}
	};
};

vi.mock('../../view/results_filter', async () => {
	const { Component } = await import('@ui-kit/component');
	const { Emitter: LocalEmitter } = await import('@sim/state/events');
	return {
		ResultsFilter: class extends Component {
			readonly changeEmitter = new LocalEmitter<void>();
			constructor(config: { parent: HTMLElement }) {
				super(config.parent, 'results-filter-root');
				islands.track('filter').parents.push(config.parent);
			}
			getFilter() {
				return { target: null };
			}
		},
	};
});
vi.mock('../../view/topline_results', async () => ({ ToplineResults: await island('topline', 'topline-results-root')() }));
vi.mock('../../view/dps_histogram', async () => ({ DpsHistogram: await island('histogram', 'dps-histogram-root')() }));
vi.mock('../../view/timeline', async () => ({ Timeline: await island('timeline', 'timeline-root')() }));
vi.mock('../../view/combat_replay', async () => ({ CombatReplay: await island('replay', 'combat-replay-root')() }));
vi.mock('../../view/log/log_view', async () => ({ LogView: await island('log', 'log-runner-root')() }));

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

const renderPane = () =>
	render(
		<SimHostProvider host={makeHost()}>
			<DetailedResults resultsManager={{ currentChangeEmitter, getRunData: () => null } as never} makeLogExporter={() => ({ open: () => {} })} />
		</SimHostProvider>,
	);

const tabButton = (container: HTMLElement, tabId: string) => container.querySelector<HTMLButtonElement>(`.dr-toolbar .nav-link[aria-controls=${tabId}]`)!;

beforeEach(() => {
	islands.records.clear();
	resultChannel = new ResultChannel();
	currentChangeEmitter = new Emitter<void>();
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
	});

	it('builds each vanilla island into the div that used to be its parent, with no wrapper', () => {
		const { container } = renderPane();
		expect(islands.track('topline').parents.map(parent => parent.className)).toEqual([
			'dr-row topline-results',
			'dr-row topline-results',
			'dr-row topline-results',
		]);
		expect(islands.track('filter').parents[0].className).toBe('results-filter');
		expect(islands.track('histogram').parents[0].className).toBe('dr-row dps-histogram');
		expect(islands.track('timeline').parents[0].className).toBe('timeline');
		expect(islands.track('replay').parents[0].className).toBe('combat-replay');
		expect(islands.track('log').parents[0].className).toBe('log');
		expect(container.querySelectorAll('#timelineTab .dr-row > .timeline > .timeline-root')).toHaveLength(1);
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

	it('tells only the newly opened deferred island that its tab is showing', () => {
		const { container } = renderPane();
		expect(islands.track('timeline').shown).toBe(0);
		fireEvent.click(tabButton(container, 'timelineTab'));
		expect(islands.track('timeline').shown).toBe(1);
		expect(islands.track('log').shown).toBe(0);
		fireEvent.click(tabButton(container, 'logTab'));
		expect(islands.track('timeline').hidden).toBe(1);
		expect(islands.track('log').shown).toBe(1);
	});

	it('stops the replay when its tab closes', () => {
		const { container } = renderPane();
		fireEvent.click(tabButton(container, 'replayTab'));
		expect(islands.track('replay').stopped).toBe(0);
		fireEvent.click(tabButton(container, 'logTab'));
		expect(islands.track('replay').hidden).toBe(1);
		expect(islands.track('replay').stopped).toBe(1);
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
