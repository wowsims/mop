import { ActionMetrics } from '@sim/proto_utils/sim_result';
import { fireEvent, render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { SimResultData } from '../../model/result_data';
import { DamageMetricsTable } from './DamageMetricsTable';

let result: SimResultData | null = null;
let showThreatMetrics = true;

vi.mock('../../hooks/useSimResult', () => ({ useSimResult: () => result }));
vi.mock('../MetricsTable/MetricsActionCell', () => ({ MetricsActionCell: ({ name }: { name: string }) => <span>{name}</span> }));
vi.mock('@sim/context/SimHostContext', async importOriginal => ({
	...(await importOriginal<typeof import('@sim/context/SimHostContext')>()),
	useSim: () => ({ getShowThreatMetrics: () => showThreatMetrics }),
}));
vi.mock('@sim/state/subscriptions', async importOriginal => ({
	...(await importOriginal<typeof import('@sim/state/subscriptions')>()),
	subscribeUiField: () => () => () => {},
}));

const NONE = { value: 0, percentage: 0, average: 0 };

const metric = (name: string, overrides: Record<string, unknown> = {}) => {
	const base: Record<string, unknown> = {
		name,
		actionId: { toStringIgnoringTag: () => name, toString: () => name },
		unit: { isPet: false, petActionId: null },
		spellSchool: null,
		damage: 100,
		avgDamage: 100,
		totalDamagePercent: 50,
		casts: 10,
		isPassiveAction: false,
		avgCastHit: 10,
		avgCastTick: 0,
		avgCastThreat: 5,
		landedHits: 10,
		landedTicks: 0,
		avgHit: 10,
		avgTick: 0,
		avgHitThreat: 5,
		critPercent: 20,
		critBlockPercent: 0,
		critTickPercent: 0,
		totalMisses: 1,
		totalMissesPercent: 10,
		misses: 1,
		missPercent: 10,
		parries: 0,
		parryPercent: 0,
		dodges: 0,
		dodgePercent: 0,
		hits: 8,
		crits: 2,
		glances: 0,
		glanceBlocks: 0,
		blocks: 0,
		critBlocks: 0,
		ticks: 0,
		critTicks: 0,
		damageThroughput: 20,
		dps: 10,
		tps: 5,
		hitAttempts: 11,
		damageDone: {
			hit: { value: 80, percentage: 80, average: 10 },
			critHit: { value: 20, percentage: 20, average: 10 },
			tick: NONE,
			critTick: NONE,
			glance: NONE,
			glanceBlock: NONE,
			block: NONE,
			critBlock: NONE,
		},
		...overrides,
	};
	base.forTarget = () => base;
	return base as unknown as ActionMetrics;
};

const pet = (name: string, overrides: Record<string, unknown> = {}) => metric(name, { unit: { isPet: true, petActionId: null }, ...overrides });

const playerResult = (actions: Array<ActionMetrics>, petActions: Array<ActionMetrics> = []) =>
	({
		filter: {},
		result: {
			getRaidIndexedPlayers: () => [
				{
					getDamageActions: () => actions,
					pets: petActions.length ? [{ name: 'Wolf', getDamageActions: () => petActions }] : [],
				},
			],
		},
	}) as unknown as SimResultData;

const rows = (container: HTMLElement) => [...container.querySelectorAll<HTMLTableRowElement>('tbody tr')];
const tooltipTable = () => document.querySelector('.sim-tooltip table.metrics-table');

describe('DamageMetricsTable', () => {
	beforeEach(() => {
		result = null;
		showThreatMetrics = true;
		// The real one builds an ActionMetrics out of protos; the parent row only needs to be a row.
		vi.spyOn(ActionMetrics, 'merge').mockImplementation(((metrics: Array<Record<string, number>>) => ({
			...metrics[0],
			damage: metrics.reduce((sum, entry) => sum + entry.damage, 0),
			dps: metrics.reduce((sum, entry) => sum + entry.dps, 0),
		})) as unknown as typeof ActionMetrics.merge);
	});

	it('builds the ten-column shell before any result', () => {
		const { container } = render(<DamageMetricsTable />);

		expect(container.querySelector('.damage-metrics-root')?.className).toBe('damage-metrics-root');
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
			'metrics-table-header-cell text-success text-body',
		]);
		expect(rows(container)).toHaveLength(0);
	});

	it('opens sorted by DPS descending and keeps a pet group as a parent with its children', () => {
		result = playerResult([metric('Steady Shot', { dps: 30 }), metric('Auto Shot', { dps: 5 })], [pet('Claw', { dps: 4 }), pet('Bite', { dps: 6 })]);
		const { container } = render(<DamageMetricsTable />);

		expect(rows(container).map(row => [row.cells[0].textContent, row.className])).toEqual([
			['Steady Shot', ''],
			['Claw', 'parent-metric expand'],
			['Bite', 'child-metric'],
			['Claw', 'child-metric'],
			['Auto Shot', ''],
		]);
	});

	it('marks a row with no hit attempts and no dps as threat-only', () => {
		result = playerResult([metric('Steady Shot'), metric('Vigilance', { hitAttempts: 0, dps: 0 })]);
		const { container } = render(<DamageMetricsTable />);

		expect(rows(container).map(row => [row.cells[0].textContent, row.className])).toEqual([
			['Steady Shot', ''],
			['Vigilance', 'threat-metrics'],
		]);
	});

	it('dashes a passive action on Avg Cast and sorts it as 0', () => {
		result = playerResult([metric('Steady Shot', { dps: 30 }), metric('Serpent Sting', { isPassiveAction: true, avgCastHit: 5, dps: 20 })]);
		const { container } = render(<DamageMetricsTable />);

		const passive = rows(container).find(row => row.cells[0].textContent === 'Serpent Sting')!;
		expect(passive.cells[3].getAttribute('data-text')).toBe('0');
		expect(passive.cells[3].textContent).toBe('-');
	});

	it('opens the damage breakdown from the primary-metric cell', async () => {
		result = playerResult([metric('Steady Shot')]);
		const { container } = render(<DamageMetricsTable />);

		fireEvent.mouseEnter(container.querySelector('td.metrics-table-cell--primary-metric')!);
		await waitFor(() => expect(tooltipTable()).toBeTruthy());
		expect([...tooltipTable()!.querySelectorAll<HTMLTableRowElement>('tbody tr')].map(row => row.cells[0].textContent)).toEqual([
			'results_tab.details.attack_types.hit',
			'results_tab.details.attack_types.critical_hit',
		]);
	});

	it('resolves a child row against its own metric, not its parent', async () => {
		result = playerResult([], [pet('Claw', { dps: 4, hits: 40, crits: 0 }), pet('Bite', { dps: 6, hits: 60, crits: 0 })]);
		const { container } = render(<DamageMetricsTable />);

		const child = rows(container).find(row => row.classList.contains('child-metric') && row.cells[0].textContent === 'Claw')!;
		fireEvent.mouseEnter(child.cells[4]);
		await waitFor(() => expect(tooltipTable()).toBeTruthy());
		expect([...tooltipTable()!.querySelectorAll<HTMLTableRowElement>('tbody tr')].map(row => row.cells[0].textContent)).toEqual([
			'results_tab.details.attack_types.hit',
		]);
		expect(tooltipTable()!.textContent).toContain('40');
	});

	it('keeps a threat tooltip shut while threat metrics are hidden, and opens it once they are shown', async () => {
		result = playerResult([metric('Steady Shot')]);
		showThreatMetrics = false;
		const hidden = render(<DamageMetricsTable />);

		fireEvent.mouseEnter(hidden.container.querySelector('td.text-success')!);
		await waitFor(() => expect(hidden.container.querySelector('td.text-success')?.getAttribute('data-tooltip-id')).toBeTruthy());
		expect(tooltipTable()).toBeNull();
		hidden.unmount();

		showThreatMetrics = true;
		const shown = render(<DamageMetricsTable />);
		fireEvent.mouseEnter(shown.container.querySelector('td.text-success')!);
		await waitFor(() => expect(tooltipTable()).toBeTruthy());
		expect(tooltipTable()!.textContent).toContain('results_tab.details.attack_types.threat');
	});

	it('anchors the avg-cast header tooltip on the header cell itself', () => {
		const { container } = render(<DamageMetricsTable />);
		const header = [...container.querySelectorAll('thead th')][3];

		expect(header.getAttribute('data-tooltip-id')).toBe('damage-metrics-avg-cast-header');
		expect(header.getAttribute('data-tooltip-content')).toBeTruthy();
	});

	it('leaves no tooltip behind when the table unmounts while one is open', async () => {
		result = playerResult([metric('Steady Shot')]);
		const { container, unmount } = render(<DamageMetricsTable />);

		fireEvent.mouseEnter(container.querySelector('td.metrics-table-cell--primary-metric')!);
		await waitFor(() => expect(tooltipTable()).toBeTruthy());

		unmount();
		expect(document.querySelectorAll('.sim-tooltip')).toHaveLength(0);
	});

	it('renders no bar denominator at all before a result, rather than -Infinity', () => {
		const { container } = render(<DamageMetricsTable />);
		expect(container.querySelectorAll('.metrics-total-bar-fill')).toHaveLength(0);
	});
});
