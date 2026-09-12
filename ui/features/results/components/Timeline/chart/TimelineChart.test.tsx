import { act, fireEvent, render } from '@testing-library/react';
import { StrictMode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { TimelineChartSpec, TimelineDataset } from '../../../model/timeline/chart/types';
import { TimelineChart } from './TimelineChart';

interface FakeChart {
	config: { data: { datasets: Array<TimelineDataset> }; options: Record<string, never>; plugins: Array<unknown> };
	data: { datasets: Array<TimelineDataset> };
	canvas: HTMLCanvasElement;
	updates: number;
	destroyed: boolean;
	update: () => void;
	destroy: () => void;
}

const charts = vi.hoisted(() => [] as Array<FakeChart>);

vi.mock('chart.js', () => ({
	Chart: class {
		data: unknown;
		updates = 0;
		destroyed = false;
		constructor(
			public canvas: HTMLCanvasElement,
			public config: { data: unknown },
		) {
			this.data = config.data;
			charts.push(this as never);
		}
		update() {
			this.updates++;
		}
		destroy() {
			this.destroyed = true;
		}
	},
}));

const dataset = (seriesId: string, label: string): TimelineDataset =>
	({
		seriesId,
		label,
		tooltipSpec: { kind: 'dps' },
		data: [{ x: 1, y: 2, log: { timestamp: 1, dps: 2, damageLogs: [], activeAuras: [] } }],
	}) as unknown as TimelineDataset;

const spec = (...datasets: Array<TimelineDataset>): TimelineChartSpec => ({ datasets, scales: { x: {} }, annotations: null, duration: 30 });

const options = (chart: FakeChart) =>
	chart.config.options as unknown as {
		plugins: { legend: { onClick: (event: unknown, item: { datasetIndex: number }) => void }; tooltip: { external: (context: unknown) => void } };
	};

beforeEach(() => {
	charts.length = 0;
});

describe('TimelineChart', () => {
	it('stands empty before the first spec, saying nothing about whether there is data', () => {
		const { container } = render(<TimelineChart spec={null} />);
		expect(container.querySelector('.timeline-chart-empty')).toBeNull();
		expect(container.querySelector('.timeline-chart-canvas')).toBeTruthy();
		expect(charts).toHaveLength(0);
	});

	it('shows the waiting state for a spec that carries no series, and still builds no chart', () => {
		const { container } = render(<TimelineChart spec={spec()} />);
		expect(container.querySelector('.timeline-chart-empty')).toBeTruthy();
		expect(container.querySelector('.timeline-chart-canvas')).toBeNull();
		expect(charts).toHaveLength(0);
	});

	it('builds one chart from the spec and swaps the empty state out', () => {
		const { container } = render(<TimelineChart spec={spec(dataset('dps', 'DPS'))} />);
		expect(charts).toHaveLength(1);
		expect(charts[0].config.data.datasets.map(entry => entry.label)).toEqual(['DPS']);
		expect(container.querySelector('.timeline-chart-empty')).toBeNull();
		expect(container.querySelector('.timeline-chart-canvas')).toBeTruthy();
	});

	it('starts with threat off and every other series on', () => {
		render(<TimelineChart spec={spec(dataset('dps', 'DPS'), dataset('threat', 'Threat'))} />);
		expect(charts[0].config.data.datasets.map(entry => entry.hidden)).toEqual([false, true]);
	});

	it('remembers a legend toggle across a rebuild, keyed by series rather than by index', () => {
		const { rerender } = render(<TimelineChart spec={spec(dataset('dps', 'DPS'), dataset('threat', 'Threat'))} />);
		act(() => options(charts[0]).plugins.legend.onClick(null, { datasetIndex: 1 }));
		expect(charts[0].data.datasets[1].hidden).toBe(false);
		expect(charts[0].updates).toBe(1);

		// A rebuild that reorders the series must still bring threat back visible.
		rerender(<TimelineChart spec={spec(dataset('threat', 'Threat'), dataset('dps', 'DPS'))} />);
		expect(charts[1].config.data.datasets.map(entry => entry.hidden)).toEqual([false, false]);
	});

	it('destroys the previous chart when the result changes, and its own on unmount', () => {
		const { rerender, unmount } = render(<TimelineChart spec={spec(dataset('dps', 'DPS'))} />);
		rerender(<TimelineChart spec={spec(dataset('dps', 'DPS'))} />);
		expect(charts).toHaveLength(2);
		expect(charts[0].destroyed).toBe(true);
		expect(charts[1].destroyed).toBe(false);

		unmount();
		expect(charts[1].destroyed).toBe(true);
	});

	// StrictMode replays the effect over the same options object the first chart was built from —
	// the same path a second result takes, and chart.js keeps a reference to what it is handed.
	it('leaves exactly one live chart under StrictMode', () => {
		render(
			<StrictMode>
				<TimelineChart spec={spec(dataset('dps', 'DPS'))} />
			</StrictMode>,
		);
		expect(charts).toHaveLength(2);
		expect(charts.filter(chart => !chart.destroyed)).toHaveLength(1);
	});

	it('renders the hovered point’s tooltip, and takes it away when the pointer leaves', () => {
		const { container } = render(<TimelineChart spec={spec(dataset('dps', 'DPS'))} />);
		const chart = charts[0];
		chart.canvas.getBoundingClientRect = () => ({ left: 0, top: 0 }) as DOMRect;
		const hover = {
			chart,
			tooltip: { opacity: 1, caretX: 10, caretY: 20, dataPoints: [{ datasetIndex: 0, dataIndex: 0, raw: chart.data.datasets[0].data[0] }] },
		};

		act(() => options(chart).plugins.tooltip.external(hover));
		expect(container.querySelector('.timeline-hover-tooltip')!.textContent).toContain('1.00s');

		act(() => options(chart).plugins.tooltip.external({ ...hover, tooltip: { ...hover.tooltip, opacity: 0 } }));
		expect(container.querySelector('.timeline-hover-tooltip')).toBeNull();
	});

	it('drives the zoom from its toolbar', () => {
		const { container } = render(<TimelineChart spec={spec(dataset('dps', 'DPS'))} />);
		const buttons = container.querySelectorAll<HTMLButtonElement>('.timeline-chart-toolbar button');
		expect(buttons).toHaveLength(5);

		fireEvent.click(buttons[2]);
		expect(charts[0].updates).toBe(1);
		fireEvent.click(buttons[0]);
		expect(charts[0].updates).toBe(2);
	});
});
