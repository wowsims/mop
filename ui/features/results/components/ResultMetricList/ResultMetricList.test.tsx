import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { ResultMetric } from '../../model/topline_metrics';
import { ResultMetricList } from './ResultMetricList';

const metric = (overrides: Partial<ResultMetric> & Pick<ResultMetric, 'metric'>): ResultMetric => ({
	name: overrides.metric.toUpperCase(),
	average: 1234.5,
	classes: `results-sim-${overrides.metric}`,
	...overrides,
});

const METRICS: Array<ResultMetric> = [
	metric({ metric: 'dps', average: 1234.5, stdev: 12.34 }),
	metric({ metric: 'tmi', average: 2.5, stdev: 0.25, unit: 'percentage' }),
	metric({ metric: 'tto', average: 30, unit: 'seconds' }),
	metric({ metric: 'oom', average: 5, unit: 'seconds', classes: 'results-sim-oom danger' }),
];

const cells = (container: HTMLElement, selector: string) => [...container.querySelectorAll(selector)].map(cell => cell.textContent);

describe('ResultMetricList row layout', () => {
	it('renders one header cell and one body cell per metric, in order', () => {
		const { container } = render(<ResultMetricList metrics={METRICS} layout="row" />);

		expect([...container.querySelectorAll('th')].map(cell => cell.className)).toEqual([
			'metrics-table-header-cell results-sim-dps',
			'metrics-table-header-cell results-sim-tmi',
			'metrics-table-header-cell results-sim-tto',
			'metrics-table-header-cell results-sim-oom danger',
		]);
		expect(cells(container, 'th')).toEqual(['DPS', 'TMI', 'TTO', 'OOM']);
		expect([...container.querySelectorAll('td')].map(cell => cell.className)).toEqual([
			'text-center align-top results-sim-dps',
			'text-center align-top results-sim-tmi',
			'text-center align-top results-sim-tto',
			'text-center align-top results-sim-oom danger',
		]);
	});

	it('formats each unit the way the metric asks for', () => {
		const { container } = render(<ResultMetricList metrics={METRICS} layout="row" />);

		expect(cells(container, '.topline-result-avg')).toEqual(['1,234.5', '2.5%', '30s', '5s']);
	});

	it('shows an error bar only for a metric that has one, at the unit precision', () => {
		const { container } = render(<ResultMetricList metrics={METRICS} layout="row" />);

		expect(cells(container, '.topline-result-stdev')).toEqual([' 12', ' 0.25']);
	});

	it('anchors every header cell to one tooltip', () => {
		const { container } = render(<ResultMetricList metrics={METRICS} layout="row" />);
		const anchors = [...container.querySelectorAll('th[data-tooltip-id]')];

		expect(anchors.map(anchor => anchor.getAttribute('data-metric'))).toEqual(['dps', 'tmi', 'tto', 'oom']);
		expect(new Set(anchors.map(anchor => anchor.getAttribute('data-tooltip-id'))).size).toBe(1);
	});

	it('keeps the reference slot the sidebar fills in', () => {
		const { container } = render(<ResultMetricList metrics={METRICS} layout="row" />);

		expect(container.querySelectorAll('td > .results-reference.hide > .results-reference-diff')).toHaveLength(4);
	});
});

describe('ResultMetricList list layout', () => {
	it('renders one metric div per metric, with the label inside the value', () => {
		const { container } = render(<ResultMetricList metrics={METRICS} layout="list" />);

		expect([...container.querySelectorAll('.results-metric')].map(row => row.className)).toEqual([
			'results-metric results-sim-dps',
			'results-metric results-sim-tmi',
			'results-metric results-sim-tto',
			'results-metric results-sim-oom danger',
		]);
		expect(cells(container, '.topline-result-avg')).toEqual(['1234.50 DPS', '2.50% TMI', '30.00 TTO', '5.00 OOM']);
	});

	it('rounds the error bar to whole numbers unless the metric is a percentage', () => {
		const { container } = render(<ResultMetricList metrics={METRICS} layout="list" />);

		expect(cells(container, '.topline-result-stdev')).toEqual(['(12)', '(0.25)']);
	});

	it('leaves out-of-mana without a tooltip anchor', () => {
		const { container } = render(<ResultMetricList metrics={METRICS} layout="list" />);

		expect([...container.querySelectorAll('.results-metric[data-tooltip-id]')].map(row => row.getAttribute('data-metric'))).toEqual(['dps', 'tmi', 'tto']);
	});
});
