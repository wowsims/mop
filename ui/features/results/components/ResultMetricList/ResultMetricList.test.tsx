import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { ResultMetric } from '../../model/topline_metrics';
import { ResultMetricList } from './ResultMetricList';

const metric = (overrides: Partial<ResultMetric> & Pick<ResultMetric, 'metric'>): ResultMetric => ({
	name: overrides.metric.toUpperCase(),
	average: 1234.5,
	...overrides,
});

const METRICS: Array<ResultMetric> = [
	metric({ metric: 'dps', average: 1234.5, stdev: 12.34 }),
	metric({ metric: 'tmi', average: 2.5, stdev: 0.25, unit: 'percentage' }),
	metric({ metric: 'tto', average: 30, unit: 'seconds' }),
	metric({ metric: 'oom', average: 5, unit: 'seconds', extraClass: 'danger' }),
];

const cells = (container: HTMLElement, selector: string) => [...container.querySelectorAll(selector)].map(cell => cell.textContent);

describe('ResultMetricList row layout', () => {
	it('renders one header cell and one body cell per metric, in order', () => {
		const { container } = render(<ResultMetricList metrics={METRICS} layout="row" />);

		const headers = [...container.querySelectorAll('th')];
		expect(headers).toHaveLength(4);
		expect(headers.every(cell => cell.classList.contains('ui-metrics-header-cell') && cell.classList.contains('font-bold'))).toBe(true);
		expect(headers.map(cell => cell.classList.contains('danger'))).toEqual([false, false, false, true]);
		expect(headers.map(cell => cell.getAttribute('data-metric-category'))).toEqual(['damage', 'threat', 'healing', null]);
		expect(cells(container, 'th')).toEqual(['DPS', 'TMI', 'TTO', 'OOM']);
		const bodyCells = [...container.querySelectorAll('td')];
		expect(bodyCells).toHaveLength(4);
		expect(bodyCells.every(cell => ['ui-metrics-cell', 'text-center', 'align-top', 'font-bold'].every(token => cell.classList.contains(token)))).toBe(true);
		expect(bodyCells.map(cell => cell.classList.contains('danger'))).toEqual([false, false, false, true]);
	});

	it('formats each unit the way the metric asks for', () => {
		const { container } = render(<ResultMetricList metrics={METRICS} layout="row" />);

		expect(cells(container, '[data-testid="topline-result-avg"]')).toEqual(['1,234.5', '2.5%', '30s', '5s']);
	});

	it('shows an error bar only for a metric that has one, at the unit precision', () => {
		const { container } = render(<ResultMetricList metrics={METRICS} layout="row" />);

		expect(cells(container, '[data-testid="topline-result-stdev"]')).toEqual([' 12', ' 0.25']);
	});

	it('anchors every header cell to one tooltip', () => {
		const { container } = render(<ResultMetricList metrics={METRICS} layout="row" />);
		const anchors = [...container.querySelectorAll('th[data-tooltip-id]')];

		expect(anchors.map(anchor => anchor.getAttribute('data-metric'))).toEqual(['dps', 'tmi', 'tto', 'oom']);
		expect(new Set(anchors.map(anchor => anchor.getAttribute('data-tooltip-id'))).size).toBe(1);
	});

	it('renders no reference slot until the sidebar fills one in', () => {
		const { container } = render(<ResultMetricList metrics={METRICS} layout="row" />);

		expect(container.querySelectorAll('td')).toHaveLength(4);
		expect(container.querySelectorAll('[data-testid="results-reference"]')).toHaveLength(0);
	});
});

describe('ResultMetricList list layout', () => {
	it('renders one metric div per metric, with the label inside the value', () => {
		const { container } = render(<ResultMetricList metrics={METRICS} layout="list" />);

		const rows = [...container.querySelectorAll('[data-testid="results-metric"]')];
		expect(rows).toHaveLength(4);
		expect(rows.every(row => row.classList.contains('text-left') && row.classList.contains('font-bold'))).toBe(true);
		expect(rows.map(row => row.classList.contains('danger'))).toEqual([false, false, false, true]);
		expect(cells(container, '[data-testid="topline-result-avg"]')).toEqual(['1234.50 DPS', '2.50 TMI', '30.00 TTO', '5.00 OOM']);
	});

	it('rounds the error bar to whole numbers unless the metric is a percentage', () => {
		const { container } = render(<ResultMetricList metrics={METRICS} layout="list" />);

		expect(cells(container, '[data-testid="topline-result-stdev"]')).toEqual(['(12)', '(0.25)']);
	});

	it('leaves out-of-mana without a tooltip anchor', () => {
		const { container } = render(<ResultMetricList metrics={METRICS} layout="list" />);

		expect([...container.querySelectorAll('[data-testid="results-metric"][data-tooltip-id]')].map(row => row.getAttribute('data-metric'))).toEqual([
			'dps',
			'tmi',
			'tto',
		]);
	});
});
