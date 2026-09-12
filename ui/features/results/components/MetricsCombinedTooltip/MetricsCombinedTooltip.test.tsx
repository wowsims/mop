import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { MetricsCombinedTooltip, type MetricsCombinedTooltipGroup } from './MetricsCombinedTooltip';

const group = (name: string | undefined, data: MetricsCombinedTooltipGroup['data']): MetricsCombinedTooltipGroup => ({
	name,
	totalPercentage: 100,
	spellSchool: null,
	data,
});

const cells = (container: HTMLElement) =>
	[...container.querySelectorAll<HTMLTableRowElement>('tbody tr')].map(row => [...row.cells].map(cell => cell.textContent));

describe('MetricsCombinedTooltip', () => {
	it('drops zero-valued entries and orders the rest by value, descending', () => {
		const { container } = render(
			<MetricsCombinedTooltip
				hasMetricBars={false}
				groups={[
					group(undefined, [
						{ name: 'Hit', value: 10, percentage: 10 },
						{ name: 'Dodge', value: 0, percentage: 0 },
						{ name: 'Crit', value: 40, percentage: 40 },
					]),
				]}
			/>,
		);
		expect(cells(container)).toEqual([
			['Crit', '40'],
			['Hit', '10'],
		]);
	});

	it('does not sort the array it was given', () => {
		const data = [
			{ name: 'Hit', value: 10, percentage: 10 },
			{ name: 'Crit', value: 40, percentage: 40 },
		];
		render(<MetricsCombinedTooltip hasMetricBars={false} groups={[group(undefined, data)]} />);
		expect(data.map(entry => entry.name)).toEqual(['Hit', 'Crit']);
	});

	it('adds the average column only when an entry carries one', () => {
		const withoutAverage = render(
			<MetricsCombinedTooltip hasMetricBars={false} groups={[group(undefined, [{ name: 'Hit', value: 10, percentage: 10 }])]} />,
		);
		expect(withoutAverage.container.querySelectorAll('thead th')).toHaveLength(2);

		const withAverage = render(
			<MetricsCombinedTooltip hasMetricBars={false} groups={[group(undefined, [{ name: 'Hit', value: 10, percentage: 10, average: 5 }])]} />,
		);
		expect([...withAverage.container.querySelectorAll('thead th')].map(th => th.textContent)).toEqual([
			'results_tab.details.tooltip_table.type',
			'results_tab.details.tooltip_table.count',
			'results_tab.details.tooltip_table.average',
		]);
		expect(cells(withAverage.container)).toEqual([['Hit', '10', '5']]);
	});

	it('takes the header overrides by position and leaves the holes at their defaults', () => {
		const { container } = render(
			<MetricsCombinedTooltip
				hasMetricBars={false}
				headerValues={[undefined, 'Amount']}
				groups={[group(undefined, [{ name: 'Hit', value: 10, percentage: 10 }])]}
			/>,
		);
		expect([...container.querySelectorAll('thead th')].map(th => th.textContent)).toEqual(['results_tab.details.tooltip_table.type', 'Amount']);
	});

	it('writes a group header row only when there is more than one named group', () => {
		const one = render(<MetricsCombinedTooltip hasMetricBars={false} groups={[group('Hits', [{ name: 'Hit', value: 10, percentage: 10 }])]} />);
		expect(one.container.querySelectorAll('.metrics-table-group-header')).toHaveLength(0);

		const two = render(
			<MetricsCombinedTooltip
				hasMetricBars={false}
				groups={[group('Hits', [{ name: 'Hit', value: 10, percentage: 10 }]), group('Ticks', [{ name: 'Tick', value: 5, percentage: 5 }])]}
			/>,
		);
		expect([...two.container.querySelectorAll('.metrics-table-group-header')].map(row => row.textContent)).toEqual(['Hits', 'Ticks']);
	});

	it('renders a total bar per row unless bars are turned off', () => {
		const { container } = render(<MetricsCombinedTooltip groups={[group(undefined, [{ name: 'Hit', value: 10, percentage: 10 }])]} />);
		expect(container.querySelectorAll('.metrics-total-bar-fill')).toHaveLength(1);
	});
});
