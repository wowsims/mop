import { ActionMetrics } from '@sim/proto_utils/sim_result';
import { fireEvent, render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { SimResultData } from '../../model/result_data';
import { DtpsMetricsTable } from './DtpsMetricsTable';

let result: SimResultData | null = null;

vi.mock('../../hooks/useSimResult', () => ({ useSimResult: () => result }));
vi.mock('../MetricsTable/MetricsActionCell', () => ({ MetricsActionCell: ({ name }: { name: string }) => <span>{name}</span> }));

const NONE = { value: 0, percentage: 0, average: 0 };

// A target's action. `makeNewTarget` gives every target a null `petActionId`, so `isPet` is false on
// every row this table can build — which is the whole of defect 12.
const metric = (name: string, overrides: Record<string, unknown> = {}) => {
	const base: Record<string, unknown> = {
		name,
		actionId: { toStringIgnoringTag: () => name, toString: () => name },
		unit: { isPet: false, petActionId: null },
		spellSchool: null,
		damage: 100,
		avgDamage: 100,
		totalDamageTakenPercent: 50,
		casts: 10,
		isPassiveAction: false,
		avgCastHit: 10,
		avgCastTick: 0,
		landedHits: 10,
		landedTicks: 0,
		avgHit: 10,
		avgTick: 0,
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
		dps: 10,
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

const targetResult = (...targets: Array<Array<ActionMetrics>>) =>
	({
		filter: {},
		result: {
			getRaidIndexedPlayers: () => [{ unitIndex: 0 }],
			getTargets: () => targets.map(actions => ({ getDamageActions: () => actions })),
		},
	}) as unknown as SimResultData;

const rows = (container: HTMLElement) => [...container.querySelectorAll<HTMLTableRowElement>('tbody tr')];
const tooltipTable = () => document.querySelector('.sim-tooltip table.metrics-table');

describe('DtpsMetricsTable', () => {
	beforeEach(() => {
		result = null;
		vi.spyOn(ActionMetrics, 'merge').mockImplementation(((metrics: Array<Record<string, number>>) => ({
			...metrics[0],
			damage: metrics.reduce((sum, entry) => sum + entry.damage, 0),
			dps: metrics.reduce((sum, entry) => sum + entry.dps, 0),
		})) as unknown as typeof ActionMetrics.merge);
	});

	it('builds the nine-column shell before any result', () => {
		const { container } = render(<DtpsMetricsTable />);

		expect(container.querySelector('.dtps-metrics-root')?.className).toBe('dtps-metrics-root');
		expect([...container.querySelectorAll('thead th')].map(th => th.getAttribute('class'))).toEqual([
			'metrics-table-header-cell',
			'metrics-table-header-cell metrics-table-cell--primary-metric text-center',
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

	it('renders a single-entry target group as a plain row, with no parent above it', () => {
		result = targetResult([metric('Melee')]);
		const { container } = render(<DtpsMetricsTable />);

		expect(rows(container).map(row => [row.cells[0].textContent, row.className])).toEqual([['Melee', '']]);
	});

	it('merges the same ability across targets into one parent with a child per target', () => {
		result = targetResult([metric('Melee', { dps: 30 })], [metric('Melee', { dps: 10 })]);
		const { container } = render(<DtpsMetricsTable />);

		expect(rows(container).map(row => [row.cells[0].textContent, row.className])).toEqual([
			['Melee', 'parent-metric expand'],
			['Melee', 'child-metric'],
			['Melee', 'child-metric'],
		]);
	});

	it('sorts a passive action as 0 on Avg Cast while still showing its value', () => {
		result = targetResult([metric('Melee', { dps: 30 }), metric('Cleave', { isPassiveAction: true, avgCastHit: 5, dps: 20 })]);
		const { container } = render(<DtpsMetricsTable />);

		const passive = rows(container).find(row => row.cells[0].textContent === 'Cleave')!;
		expect(passive.cells[3].getAttribute('data-text')).toBe('0');
		expect(passive.cells[3].textContent).toBe('5');
	});

	it('opens the damage-taken breakdown from the primary-metric cell', async () => {
		result = targetResult([metric('Melee')]);
		const { container } = render(<DtpsMetricsTable />);

		fireEvent.mouseEnter(container.querySelector('td.metrics-table-cell--primary-metric')!);
		await waitFor(() => expect(tooltipTable()).toBeTruthy());
		expect([...tooltipTable()!.querySelectorAll<HTMLTableRowElement>('tbody tr')].map(row => row.cells[0].textContent)).toEqual([
			'results_tab.details.attack_types.hit',
			'results_tab.details.attack_types.critical_hit',
		]);
	});

	it('carries no tooltip on Avg Hit or on the rate column, so a target reports no threat', () => {
		result = targetResult([metric('Melee')]);
		const { container } = render(<DtpsMetricsTable />);

		const cells = rows(container)[0].cells;
		expect(cells[5].getAttribute('data-tooltip-id')).toBeNull();
		expect(cells[8].getAttribute('data-tooltip-id')).toBeNull();
		expect(container.querySelector('td.text-success')?.getAttribute('data-tooltip-id')).toBeNull();
	});

	it('anchors both header tooltips on their own header cell', () => {
		const { container } = render(<DtpsMetricsTable />);
		const headers = [...container.querySelectorAll('thead th')];

		expect(headers[3].getAttribute('data-tooltip-id')).toBe('dtps-metrics-avg-cast-header');
		expect(headers[3].getAttribute('data-tooltip-content')).toBeTruthy();
		expect(headers[6].getAttribute('data-tooltip-id')).toBe('dtps-metrics-miss-percent-header');
		expect(headers[6].getAttribute('data-tooltip-content')).toBeTruthy();
	});

	it('renders no bar denominator at all before a result, rather than -Infinity', () => {
		const { container } = render(<DtpsMetricsTable />);
		expect(container.querySelectorAll('.metrics-total-bar-fill')).toHaveLength(0);
	});
});
