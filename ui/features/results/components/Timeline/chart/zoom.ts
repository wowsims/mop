import { Chart, Plugin } from 'chart.js';

export interface XRange {
	min?: number;
	max?: number;
}

const MIN_RANGE = 0.5;
const DRAG_THRESHOLD_PX = 5;

// Owns the x range outright rather than delegating to a plugin, so a reset is always
// `[0, duration]` of the result currently on screen and cannot drift when the duration
// changes between results.
export class ChartZoom {
	private duration = 1;
	private min = 0;
	private max = 1;
	private drag: { fromPx: number; toPx: number } | null = null;
	private panning = false;
	private lastPanPx = 0;
	private pointerId: number | null = null;

	constructor(
		private readonly getChart: () => Chart | null,
		// The raw x-scale options the chart was configured with. chart.js rebuilds
		// `config.options.scales` on every update, so the range has to be written into the
		// object the owner keeps, never into the resolved `chart.options` proxy.
		private readonly getXOptions: () => XRange | undefined,
		private readonly onDragStateChange: (dragging: boolean) => void,
	) {}

	setDuration(duration: number) {
		this.duration = Math.max(duration, MIN_RANGE);
		this.min = 0;
		this.max = this.duration;
	}

	// Writes the owned range without updating, for callers that are about to update anyway.
	write() {
		const scale = this.getXOptions();
		if (!scale) return;
		scale.min = this.min;
		scale.max = this.max;
	}

	reset() {
		this.setRange(0, this.duration);
	}

	zoomBy(factor: number, anchorTime = (this.min + this.max) / 2) {
		const width = this.max - this.min;
		if (width <= 0) return;
		const ratio = Math.min(Math.max((anchorTime - this.min) / width, 0), 1);
		const next = Math.min(Math.max(width / factor, MIN_RANGE), this.duration);
		this.setRange(anchorTime - next * ratio, anchorTime + next * (1 - ratio));
	}

	panBy(deltaPx: number) {
		const chart = this.getChart();
		if (!chart) return;
		const seconds = this.pxToSeconds(chart, deltaPx);
		if (!seconds) return;
		this.setRange(this.min + seconds, this.max + seconds);
	}

	attach(canvas: HTMLCanvasElement): () => void {
		const onDown = (event: PointerEvent) => {
			const chart = this.getChart();
			if (!chart || event.button !== 0) return;
			const x = this.hitX(chart, event);
			if (x == null) return;

			event.preventDefault();
			canvas.setPointerCapture(event.pointerId);
			this.pointerId = event.pointerId;
			if (event.shiftKey) {
				this.panning = true;
				this.lastPanPx = x;
			} else {
				this.drag = { fromPx: x, toPx: x };
				this.onDragStateChange(true);
			}
		};

		const onMove = (event: PointerEvent) => {
			if (this.pointerId !== event.pointerId) return;
			const chart = this.getChart();
			if (!chart) return;
			const x = this.clampToArea(chart, event.clientX - chart.canvas.getBoundingClientRect().left);
			if (this.panning) {
				this.panBy(this.lastPanPx - x);
				this.lastPanPx = x;
			} else if (this.drag) {
				this.drag.toPx = x;
				chart.render();
			}
		};

		const onUp = (event: PointerEvent) => {
			if (this.pointerId !== event.pointerId) return;
			const drag = this.drag;
			const chart = this.getChart();
			this.finish(canvas, event.pointerId);
			if (!drag || !chart) return;

			if (Math.abs(drag.toPx - drag.fromPx) < DRAG_THRESHOLD_PX) {
				chart.render();
				return;
			}
			const scale = chart.scales.x;
			const from = scale.getValueForPixel(Math.min(drag.fromPx, drag.toPx)) ?? this.min;
			const to = scale.getValueForPixel(Math.max(drag.fromPx, drag.toPx)) ?? this.max;
			this.setRange(from, to);
		};

		const onCancel = (event: PointerEvent) => {
			if (this.pointerId !== event.pointerId) return;
			this.finish(canvas, event.pointerId);
			this.getChart()?.render();
		};

		canvas.addEventListener('pointerdown', onDown);
		canvas.addEventListener('pointermove', onMove);
		canvas.addEventListener('pointerup', onUp);
		canvas.addEventListener('pointercancel', onCancel);
		return () => {
			canvas.removeEventListener('pointerdown', onDown);
			canvas.removeEventListener('pointermove', onMove);
			canvas.removeEventListener('pointerup', onUp);
			canvas.removeEventListener('pointercancel', onCancel);
		};
	}

	plugin(): Plugin<'line'> {
		return {
			id: 'timelineZoomSelection',
			afterDraw: chart => {
				const drag = this.drag;
				if (!drag) return;
				const left = Math.min(drag.fromPx, drag.toPx);
				const right = Math.max(drag.fromPx, drag.toPx);
				if (right - left < 1) return;

				const { ctx, chartArea } = chart;
				ctx.save();
				ctx.beginPath();
				ctx.rect(chartArea.left, chartArea.top, chartArea.right - chartArea.left, chartArea.bottom - chartArea.top);
				ctx.clip();
				ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
				ctx.fillRect(left, chartArea.top, right - left, chartArea.bottom - chartArea.top);
				ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
				ctx.lineWidth = 1;
				ctx.strokeRect(left + 0.5, chartArea.top + 0.5, right - left - 1, chartArea.bottom - chartArea.top - 1);
				ctx.restore();
			},
		};
	}

	private setRange(min: number, max: number) {
		const width = Math.min(Math.max(max - min, MIN_RANGE), this.duration);
		const start = Math.min(Math.max(min, 0), this.duration - width);
		this.min = start;
		this.max = start + width;
		this.write();
		this.getChart()?.update('none');
	}

	private pxToSeconds(chart: Chart, deltaPx: number): number {
		const scale = chart.scales.x;
		if (!scale) return 0;
		const from = scale.getValueForPixel(scale.left);
		const to = scale.getValueForPixel(scale.left + deltaPx);
		return from == null || to == null ? 0 : to - from;
	}

	private hitX(chart: Chart, event: PointerEvent): number | null {
		const rect = chart.canvas.getBoundingClientRect();
		const x = event.clientX - rect.left;
		const y = event.clientY - rect.top;
		const area = chart.chartArea;
		if (!area || x < area.left || x > area.right || y < area.top || y > area.bottom) return null;
		return x;
	}

	private clampToArea(chart: Chart, x: number): number {
		const area = chart.chartArea;
		return area ? Math.min(Math.max(x, area.left), area.right) : x;
	}

	private finish(canvas: HTMLCanvasElement, pointerId: number) {
		if (canvas.hasPointerCapture(pointerId)) canvas.releasePointerCapture(pointerId);
		this.pointerId = null;
		this.panning = false;
		if (this.drag) {
			this.drag = null;
			this.onDragStateChange(false);
		}
	}
}
