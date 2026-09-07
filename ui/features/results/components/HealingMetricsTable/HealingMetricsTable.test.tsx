import { ActionMetrics } from '@domain/proto_utils/sim_result';
import { fireEvent, render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { SimResultData } from '../../model/result_data';
import { HealingMetricsTable } from './HealingMetricsTable';

let result: SimResultData | null = null;
let showThreatMetrics = true;

vi.mock('../../hooks/useSimResult', () => ({ useSimResult: () => result }));
vi.mock('../MetricsTable/MetricsActionCell', () => ({ MetricsActionCell: ({ name }: { name: string }) => <span>{name}</span> }));
vi.mock('@features/SimHostContext', async importOriginal => ({
	...(await importOriginal<typeof import('@features/SimHostContext')>()),
	useSim: () => ({ getShowThreatMetrics: () => showThreatMetrics }),
}));
vi.mock('@domain/state/subscriptions', async importOriginal => ({
	...(await importOriginal<typeof import('@domain/state/subscriptions')>()),
	subscribeUiField: () => () => () => {},
}));

const metric = (name: string, overrides: Record<string, unknown> = {}) => {
	const base: Record<string, unknown> = {
		name,
		actionId: { toStringIgnoringTag: () => name, toString: () => name },
		unit: { isPet: false, petActionId: null },
		spellSchool: null,
		healing: 100,
		avgHealing: 100,
		avgCritHealing: 20,
		healingPercent: 80,
		healingCritPercent: 20,
		shielding: 40,
		totalHealingPercent: 50,
		casts: 10,
		castsPerMinute: 20,
		avgCastTimeMs: 1500,
		avgCastHealing: 10,
		avgCastThreat: 5,
		landedHits: 10,
		landedTicks: 0,
		avgHitHealing: 10,
		avgHitThreat: 5,
		hpm: 3,
		critPercent: 20,
		critTickPercent: 0,
		healingThroughput: 40,
		hits: 8,
		crits: 2,
		glances: 0,
		blocks: 0,
		critBlocks: 0,
		ticks: 0,
		critTicks: 0,
		hps: 10,
		tps: 5,
		hitAttempts: 11,
		...overrides,
	};
	return base as unknown as ActionMetrics;
};

const playerResult = (actions: Array<ActionMetrics>) =>
	({
		filter: {},
		result: { getRaidIndexedPlayers: () => [{ getHealingActions: () => actions }] },
	}) as unknown as SimResultData;

const rows = (container: HTMLElement) => [...container.querySelectorAll<HTMLTableRowElement>('tbody tr')];
const tooltipTable = () => document.querySelector('.sim-tooltip table.metrics-table');

describe('HealingMetricsTable', () => {
	beforeEach(() => {
		result = null;
		showThreatMetrics = true;
		vi.spyOn(ActionMetrics, 'merge').mockImplementation(((metrics: Array<Record<string, number>>) => ({
			...metrics[0],
			healing: metrics.reduce((sum, entry) => sum + entry.healing, 0),
			hps: metrics.reduce((sum, entry) => sum + entry.hps, 0),
		})) as unknown as typeof ActionMetrics.merge);
	});

	it('builds the twelve-column shell before any result', () => {
		const { container } = render(<HealingMetricsTable />);

		expect(container.querySelector('.healing-metrics-root')?.className).toBe('healing-metrics-root');
		expect([...container.querySelectorAll('thead th')].map(th => th.getAttribute('class'))).toEqual([
			'metrics-table-header-cell',
			'metrics-table-header-cell metrics-table-cell--primary-metric text-center',
			'metrics-table-header-cell',
			'metrics-table-header-cell',
			'metrics-table-header-cell',
			'metrics-table-header-cell',
			'metrics-table-header-cell',
			'metrics-table-header-cell',
			'metrics-table-header-cell',
			'metrics-table-header-cell',
			'metrics-table-header-cell',
			'metrics-table-header-cell text-success text-body',
		]);
		expect(rows(container)).toHaveLength(0);
	});

	it('drops an action with no healing and opens sorted by HPS descending', () => {
		result = playerResult([metric('Healing Touch', { hps: 4 }), metric('Rejuvenation', { hps: 12 }), metric('Melee', { hps: 0 })]);
		const { container } = render(<HealingMetricsTable />);

		expect(rows(container).map(row => row.cells[0].textContent)).toEqual(['Rejuvenation', 'Healing Touch']);
	});

	it('draws the shielding overlay as a second bar fill', () => {
		result = playerResult([metric('Healing Touch')]);
		const { container } = render(<HealingMetricsTable />);

		expect(container.querySelectorAll('td.metrics-table-cell--primary-metric .metrics-total-bar-fill')).toHaveLength(2);
	});

	it('drops the overlay bar when nothing is shielded', () => {
		result = playerResult([metric('Healing Touch', { shielding: 0 })]);
		const { container } = render(<HealingMetricsTable />);

		expect(container.querySelectorAll('td.metrics-table-cell--primary-metric .metrics-total-bar-fill')).toHaveLength(1);
	});

	it('opens the healing breakdown with its average column from the primary-metric cell', async () => {
		result = playerResult([metric('Healing Touch')]);
		const { container } = render(<HealingMetricsTable />);

		fireEvent.mouseEnter(container.querySelector('td.metrics-table-cell--primary-metric')!);
		await waitFor(() => expect(tooltipTable()).toBeTruthy());
		expect([...tooltipTable()!.querySelectorAll('thead th')]).toHaveLength(3);
		expect([...tooltipTable()!.querySelectorAll<HTMLTableRowElement>('tbody tr')].map(row => row.cells[0].textContent)).toEqual([
			'results_tab.details.attack_types.hit',
			'results_tab.details.attack_types.critical_hit',
		]);
	});

	it('keeps a threat tooltip shut while threat metrics are hidden, and opens it once they are shown', async () => {
		result = playerResult([metric('Healing Touch')]);
		showThreatMetrics = false;
		const hidden = render(<HealingMetricsTable />);

		fireEvent.mouseEnter(hidden.container.querySelector('td.text-success')!);
		await waitFor(() => expect(hidden.container.querySelector('td.text-success')?.getAttribute('data-tooltip-id')).toBeTruthy());
		expect(tooltipTable()).toBeNull();
		hidden.unmount();

		showThreatMetrics = true;
		const shown = render(<HealingMetricsTable />);
		fireEvent.mouseEnter(shown.container.querySelector('td.text-success')!);
		await waitFor(() => expect(tooltipTable()).toBeTruthy());
		expect(tooltipTable()!.textContent).toContain('results_tab.details.attack_types.threat');
	});

	it('names the two groups of the hits breakdown', async () => {
		result = playerResult([metric('Healing Touch', { landedTicks: 4, ticks: 4 })]);
		const { container } = render(<HealingMetricsTable />);

		fireEvent.mouseEnter(rows(container)[0].cells[6]);
		await waitFor(() => expect(tooltipTable()).toBeTruthy());
		expect([...tooltipTable()!.querySelectorAll('tbody th')].map(th => th.textContent)).toEqual(['Hits', 'Ticks']);
	});

	it('anchors all three header tooltips on their own header cell', () => {
		const { container } = render(<HealingMetricsTable />);
		const headers = [...container.querySelectorAll('thead th')];

		expect(headers[5].getAttribute('data-tooltip-id')).toBe('healing-metrics-avg-cast-header');
		expect(headers[6].getAttribute('data-tooltip-id')).toBe('healing-metrics-hits-header');
		expect(headers[7].getAttribute('data-tooltip-id')).toBe('healing-metrics-avg-hit-header');
		expect(headers.map(th => th.getAttribute('data-tooltip-content')).filter(Boolean)).toHaveLength(3);
	});

	it('leaves no tooltip behind when the table unmounts while one is open', async () => {
		result = playerResult([metric('Healing Touch')]);
		const { container, unmount } = render(<HealingMetricsTable />);

		fireEvent.mouseEnter(container.querySelector('td.metrics-table-cell--primary-metric')!);
		await waitFor(() => expect(tooltipTable()).toBeTruthy());

		unmount();
		expect(document.querySelectorAll('.sim-tooltip')).toHaveLength(0);
	});

	it('renders no bar denominator at all before a result, rather than -Infinity', () => {
		const { container } = render(<HealingMetricsTable />);
		expect(container.querySelectorAll('.metrics-total-bar-fill')).toHaveLength(0);
	});
});
