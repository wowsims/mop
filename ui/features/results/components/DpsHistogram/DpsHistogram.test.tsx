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
		destroyed = false;
		constructor(
			_ctx: unknown,
			public config: never,
		) {
			charts.push(this as never);
		}
		destroy() {
			this.destroyed = true;
		}
	},
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

	it('destroys the chart and clears the root when it goes away', () => {
		result = resultWith({ 100: 1 }, 100, 10);
		const { container, unmount } = render(<DpsHistogram />);
		const root = container.querySelector('.dps-histogram-root')!;
		unmount();

		expect(charts[0].destroyed).toBe(true);
		expect(root.children).toHaveLength(0);
	});
});
