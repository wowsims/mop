import { act, fireEvent, render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { MetricRow } from '../../model/grouping';
import { MetricsTable } from './MetricsTable';
import { createMetricsColumnHelper } from '../../hooks/useMetricsTable';

interface Metric {
	name: string;
	value: number;
}

const helper = createMetricsColumnHelper<Metric>();

// The Name cell's text is deliberately the reverse of its model name's order, so a sort that read
// the rendered cell — as `TableSorter` did — orders these three the other way round.
const RENDERED_NAME: Record<string, string> = { Alpha: 'zzz', Beta: 'mmm', Charlie: 'aaa' };

const columns = helper.columns([
	helper.accessor(row => row.metric.name, {
		id: 'name',
		header: 'Name',
		cell: info => RENDERED_NAME[info.getValue()] ?? info.getValue(),
	}),
	helper.accessor(row => row.metric.value, {
		id: 'value',
		header: 'Value',
		cell: info => String(info.getValue()),
	}),
]);

const metric = (name: string, value: number): Metric => ({ name, value });

const buildRows = (): Array<MetricRow<Metric>> => [
	{ metric: metric('Charlie', 30) },
	{ metric: metric('Beta', 70), subRows: [{ metric: metric('Bite', 20) }, { metric: metric('Claw', 50) }] },
	{ metric: metric('Alpha', 10) },
];

const table = (container: HTMLElement) => ({
	headers: [...container.querySelectorAll('thead th')] as Array<HTMLElement>,
	rows: [...container.querySelectorAll('tbody tr')] as Array<HTMLTableRowElement>,
});

const column = (container: HTMLElement, index: number, filter?: (row: HTMLTableRowElement) => boolean) =>
	table(container)
		.rows.filter(row => filter?.(row) ?? true)
		.map(row => row.cells[index].getAttribute('data-text'));

const parents = (row: HTMLTableRowElement) => !row.classList.contains('child-metric');

const sortButton = (header: HTMLElement) => header.querySelector('button')!;

const ariaSorts = (container: HTMLElement) => table(container).headers.map(header => header.getAttribute('aria-sort'));

describe('MetricsTable', () => {
	it('builds the whole shell before any result, with an empty body and no hide', () => {
		const { container } = render(<MetricsTable rootClassName="test-metrics-root" columns={columns} rows={[]} sortColumnId="value" hasResult={false} />);

		expect(container.querySelector('.test-metrics-root')?.className).toBe('test-metrics-root');
		expect(container.querySelector('table')?.className).toBe('metrics-table');
		expect(container.querySelector('thead')?.className).toBe('metrics-table-header');
		expect(container.querySelector('thead tr')?.className).toBe('metrics-table-header-row');
		expect(container.querySelector('tbody')?.className).toBe('metrics-table-body');
		expect(table(container).headers.map(header => [header.className, header.firstElementChild?.tagName, header.textContent])).toEqual([
			['metrics-table-header-cell', 'BUTTON', 'Name'],
			['metrics-table-header-cell', 'BUTTON', 'Value'],
		]);
		expect(table(container).headers.map(header => header.querySelector('span')?.textContent)).toEqual(['Name', 'Value']);
		expect(table(container).rows).toHaveLength(0);
	});

	it('makes every sortable header a real button and reports the sort on the cell', () => {
		const { container } = render(
			<MetricsTable rootClassName="test-metrics-root" columns={columns} rows={buildRows()} sortColumnId="value" hasResult={true} />,
		);
		const buttons = table(container).headers.map(sortButton);

		expect(buttons.map(button => [button.tagName, button.getAttribute('type'), button.className])).toEqual([
			['BUTTON', 'button', 'metrics-table-sort'],
			['BUTTON', 'button', 'metrics-table-sort'],
		]);
		expect(ariaSorts(container)).toEqual(['none', 'descending']);

		fireEvent.click(buttons[1]);
		expect(column(container, 1, parents)).toEqual(['10', '30', '70']);
		expect(ariaSorts(container)).toEqual(['none', 'ascending']);

		fireEvent.click(buttons[0]);
		expect(ariaSorts(container)).toEqual(['ascending', 'none']);
	});

	it('hides the root only once a result has produced no rows', () => {
		const { container, rerender } = render(
			<MetricsTable rootClassName="test-metrics-root" columns={columns} rows={[]} sortColumnId="value" hasResult={false} />,
		);
		expect(container.querySelector('.test-metrics-root')?.classList.contains('hide')).toBe(false);

		rerender(<MetricsTable rootClassName="test-metrics-root" columns={columns} rows={[]} sortColumnId="value" hasResult={true} />);
		expect(container.querySelector('.test-metrics-root')?.classList.contains('hide')).toBe(true);
	});

	it('opens sorted descending on the configured column', () => {
		const { container } = render(
			<MetricsTable rootClassName="test-metrics-root" columns={columns} rows={buildRows()} sortColumnId="value" hasResult={true} />,
		);
		expect(column(container, 1, parents)).toEqual(['70', '30', '10']);
	});

	it('sorts ascending on a first click, descending on a second, and never clears on a third', () => {
		const { container } = render(
			<MetricsTable rootClassName="test-metrics-root" columns={columns} rows={buildRows()} sortColumnId="value" hasResult={true} />,
		);
		const value = table(container).headers[1];

		fireEvent.click(value);
		expect(column(container, 1, parents)).toEqual(['10', '30', '70']);
		fireEvent.click(value);
		expect(column(container, 1, parents)).toEqual(['70', '30', '10']);
		fireEvent.click(value);
		expect(column(container, 1, parents)).toEqual(['10', '30', '70']);
	});

	it('sorts the Name column by the metric name, not by the rendered cell', () => {
		const { container } = render(
			<MetricsTable rootClassName="test-metrics-root" columns={columns} rows={buildRows()} sortColumnId="value" hasResult={true} />,
		);

		fireEvent.click(table(container).headers[0]);
		expect(column(container, 0, parents)).toEqual(['Alpha', 'Beta', 'Charlie']);
		expect(
			table(container)
				.rows.filter(parents)
				.map(row => row.cells[0].textContent),
		).toEqual(['zzz', 'mmm', 'aaa']);
	});

	it('replaces the sort on a shift-click rather than adding a second column', () => {
		const { container } = render(
			<MetricsTable rootClassName="test-metrics-root" columns={columns} rows={buildRows()} sortColumnId="value" hasResult={true} />,
		);

		fireEvent.click(table(container).headers[0]);
		expect(column(container, 0, parents)).toEqual(['Alpha', 'Beta', 'Charlie']);

		// Names are unique, so a second sort column would leave that order untouched.
		fireEvent.click(table(container).headers[1], { shiftKey: true });
		expect(column(container, 1, parents)).toEqual(['10', '30', '70']);
	});

	it('keeps child rows with their parent and re-sorts them by the same column', () => {
		const { container } = render(
			<MetricsTable rootClassName="test-metrics-root" columns={columns} rows={buildRows()} sortColumnId="value" hasResult={true} />,
		);

		expect(table(container).rows.map(row => [row.cells[0].getAttribute('data-text'), row.className])).toEqual([
			['Beta', 'parent-metric expand'],
			['Claw', 'child-metric'],
			['Bite', 'child-metric'],
			['Charlie', ''],
			['Alpha', ''],
		]);

		fireEvent.click(table(container).headers[1]);
		expect(table(container).rows.map(row => row.cells[0].getAttribute('data-text'))).toEqual(['Alpha', 'Charlie', 'Beta', 'Bite', 'Claw']);
	});

	it('starts every parent expanded and unmounts its children when it is collapsed', () => {
		const { container } = render(
			<MetricsTable rootClassName="test-metrics-root" columns={columns} rows={buildRows()} sortColumnId="value" hasResult={true} />,
		);
		const parent = table(container).rows[0];
		expect(parent.classList.contains('expand')).toBe(true);
		expect(table(container).rows.filter(row => row.classList.contains('child-metric'))).toHaveLength(2);

		fireEvent.click(parent);
		expect(parent.classList.contains('expand')).toBe(false);
		expect(table(container).rows.filter(row => row.classList.contains('child-metric'))).toHaveLength(0);

		fireEvent.click(parent);
		expect(parent.classList.contains('expand')).toBe(true);
		expect(table(container).rows.filter(row => row.classList.contains('child-metric'))).toHaveLength(2);
	});

	it('keeps its state across a re-render with the same rows and resets expansion when they change', async () => {
		const rows = buildRows();
		const { container, rerender } = render(
			<MetricsTable rootClassName="test-metrics-root" columns={columns} rows={rows} sortColumnId="value" hasResult={true} />,
		);

		fireEvent.click(table(container).headers[1]);
		fireEvent.click(table(container).rows[2]);
		expect(column(container, 1, parents)).toEqual(['10', '30', '70']);
		expect(table(container).rows.filter(row => row.classList.contains('child-metric'))).toHaveLength(0);

		rerender(<MetricsTable rootClassName="test-metrics-root" columns={columns} rows={rows} sortColumnId="value" hasResult={true} />);
		expect(column(container, 1, parents)).toEqual(['10', '30', '70']);
		expect(table(container).rows.filter(row => row.classList.contains('child-metric'))).toHaveLength(0);

		// A new result is a new array, and every parent comes back open — as rebuilding the body did.
		// `autoResetExpanded` runs in a microtask after the row model rebuilds, hence the flush.
		rerender(<MetricsTable rootClassName="test-metrics-root" columns={columns} rows={buildRows()} sortColumnId="value" hasResult={true} />);
		await act(async () => {});
		expect(table(container).rows.filter(row => row.classList.contains('child-metric'))).toHaveLength(2);
	});
});
