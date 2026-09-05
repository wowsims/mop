import { Chart, TooltipModel } from 'chart.js';

import { TimelineDataset, TimelinePoint } from './types';

const VIEWPORT_PADDING = 8;
const CURSOR_OFFSET = 12;

export interface TooltipContext {
	chart: Chart;
	tooltip: TooltipModel<'line'>;
}

export class ChartTooltip {
	private host: HTMLElement | null = null;
	private frame: number | null = null;
	private pending: TooltipContext | null = null;
	private pendingKey = '';
	private renderedKey = '';

	suppressed = false;

	handle(context: TooltipContext) {
		const { chart, tooltip } = context;
		if (this.suppressed || tooltip.opacity === 0 || !tooltip.dataPoints?.length) {
			this.hide();
			return;
		}

		const host = this.ensureHost();
		this.pending = context;

		const key = tooltip.dataPoints.map(point => `${point.datasetIndex}:${point.dataIndex}`).join(',');
		if (key !== this.renderedKey && key !== this.pendingKey) {
			this.pendingKey = key;
			if (this.frame == null) {
				this.frame = requestAnimationFrame(() => {
					this.frame = null;
					this.build();
				});
			}
		}

		host.classList.remove('hide');
		this.place(chart, tooltip);
	}

	// The cached key is datasetIndex + dataIndex, which a new result can reuse for a
	// different log, so replacing the datasets has to drop it.
	invalidate() {
		this.hide();
		this.renderedKey = '';
	}

	hide() {
		if (this.frame != null) {
			cancelAnimationFrame(this.frame);
			this.frame = null;
		}
		this.pending = null;
		this.pendingKey = '';
		this.host?.classList.add('hide');
	}

	dispose() {
		this.hide();
		this.host?.remove();
		this.host = null;
		this.renderedKey = '';
	}

	private build() {
		const pending = this.pending;
		if (!pending || !this.host) return;

		const { chart, tooltip } = pending;
		const point = tooltip.dataPoints[0];
		const dataset = point && (chart.data.datasets[point.datasetIndex] as TimelineDataset | undefined);
		const raw = point?.raw as TimelinePoint | undefined;
		if (!dataset?.renderTooltip || !raw?.log) return;

		this.renderedKey = this.pendingKey;
		this.host.replaceChildren(dataset.renderTooltip(raw.log));
		this.place(chart, tooltip);
	}

	private place(chart: Chart, tooltip: TooltipModel<'line'>) {
		const host = this.host;
		const canvas = chart.canvas;
		if (!host || !canvas) return;

		const canvasRect = canvas.getBoundingClientRect();
		const rect = host.getBoundingClientRect();
		const anchorX = canvasRect.left + tooltip.caretX;
		const anchorY = canvasRect.top + tooltip.caretY;

		let left = anchorX + CURSOR_OFFSET;
		if (left + rect.width > window.innerWidth - VIEWPORT_PADDING) left = anchorX - CURSOR_OFFSET - rect.width;
		left = Math.max(VIEWPORT_PADDING, Math.min(left, window.innerWidth - VIEWPORT_PADDING - rect.width));

		let top = anchorY + CURSOR_OFFSET;
		if (top + rect.height > window.innerHeight - VIEWPORT_PADDING) top = window.innerHeight - VIEWPORT_PADDING - rect.height;
		top = Math.max(VIEWPORT_PADDING, top);

		host.style.setProperty('--tooltip-x', String(Math.round(left)));
		host.style.setProperty('--tooltip-y', String(Math.round(top)));
	}

	private ensureHost(): HTMLElement {
		if (!this.host) {
			this.host = document.createElement('div');
			this.host.className = 'timeline-chart-tooltip hide';
			document.body.appendChild(this.host);
		}
		return this.host;
	}
}
