import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { SimResultData } from '../../model/result_data';
import { DpsHistogram } from './DpsHistogram';

let result: SimResultData | null = null;
const charts: Array<{
	config: { data: { labels: Array<string>; datasets: Array<{ data: Array<number>; backgroundColor: Array<string> }> } };
	destroyed: boolean;
}> = [];

vi.mock('../../hooks/useSimResult', () => ({ useSimResult: () => result }));
vi.mock('chart.js', () => ({
	Chart: class {
		static register() {}
		destroyed = false;
		constructor(
			_ctx: unknown,
			public config: never,
		) {
			charts.push(this as never);
		}
		update() {}
		destroy() {
			this.destroyed = true;
		}
	},
	BarController: class {},
	BubbleController: class {},
	DoughnutController: class {},
	LineController: class {},
	PieController: class {},
	PolarAreaController: class {},
	RadarController: class {},
	ScatterController: class {},
}));

const resultWith = (hist: Record<number, number>, avg: number, stdev: number) =>
	({ result: { getDamageMetrics: () => ({ avg, stdev, hist }) }, filter: {} }) as never;

beforeEach(() => {
	result = null;
	charts.length = 0;
});

describe('DpsHistogram', () => {
	it('renders an empty root before the first run', () => {
		const { container } = render(<DpsHistogram />);

		expect(container.querySelector('.dps-histogram-root')!.children).toHaveLength(0);
		expect(charts).toHaveLength(0);
	});

	it('builds one canvas and one chart from the damage histogram', () => {
		result = resultWith({ 100: 1, 200: 5, 300: 2 }, 200, 50);
		const { container } = render(<DpsHistogram />);

		expect(container.querySelectorAll('.dps-histogram-root > canvas')).toHaveLength(1);
		expect(charts).toHaveLength(1);
		expect(charts[0].config.data.labels).toEqual(['100', '200', '300']);
		expect(charts[0].config.data.datasets[0].data).toEqual([1, 5, 2]);
	});

	it('colours the buckets inside one standard deviation apart from the rest', () => {
		result = resultWith({ 100: 1, 200: 5, 300: 2 }, 200, 50);
		render(<DpsHistogram />);

		expect(charts[0].config.data.datasets[0].backgroundColor).toEqual(['#FF6961', '#1E87F0', '#FF6961']);
	});

	it('carries a second result through the one chart rather than rebuilding it', () => {
		result = resultWith({ 100: 1, 200: 5, 300: 2 }, 200, 50);
		const { rerender } = render(<DpsHistogram />);
		result = resultWith({ 400: 3, 500: 7 }, 450, 60);
		rerender(<DpsHistogram />);

		expect(charts).toHaveLength(1);
		expect(charts[0].destroyed).toBe(false);
		expect(charts[0].config.data.labels).toEqual(['400', '500']);
		expect(charts[0].config.data.datasets[0].data).toEqual([3, 7]);
	});

	it('destroys the chart and drops the canvas when the result goes away', () => {
		result = resultWith({ 100: 1 }, 100, 10);
		const { container, rerender } = render(<DpsHistogram />);
		result = null;
		rerender(<DpsHistogram />);

		expect(charts[0].destroyed).toBe(true);
		expect(container.querySelector('.dps-histogram-root')!.children).toHaveLength(0);
	});

	it('destroys the chart when it unmounts', () => {
		result = resultWith({ 100: 1 }, 100, 10);
		render(<DpsHistogram />).unmount();

		expect(charts[0].destroyed).toBe(true);
	});
});
