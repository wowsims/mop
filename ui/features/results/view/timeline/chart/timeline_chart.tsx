/** @jsxImportSource @jsx-vanilla */
import i18n from '@i18n/config';
import { Chart, ChartConfiguration, ChartOptions } from 'chart.js';
import { ref } from 'tsx-vanilla';

import { annotationsPlugin } from './annotations';
import { THREAT_SERIES_ID } from './series';
import { ChartToolbar } from './toolbar';
import { ChartTooltip } from './tooltip';
import { AnnotationSpec, TimelineChartSpec, TimelineDataset } from './types';
import { ChartZoom, XRange } from './zoom';

const PAN_STEP_PX = 60;
const ZOOM_STEP = 1.2;

export class TimelineChart {
	private readonly canvas: HTMLCanvasElement;
	private readonly canvasWrapper: HTMLElement;
	private readonly emptyElem: HTMLElement;
	private readonly tooltip = new ChartTooltip();
	private readonly zoom: ChartZoom;
	// The one raw options object the chart is configured with. chart.js replaces its
	// `scales` in place on every update, so this reference - not `chart.options`, which is a
	// resolver proxy - is what the scales and the zoom range have to be written through.
	private readonly options: ChartOptions<'line'>;
	// Keyed by the stable series id, not by dataset index or legend label, so it survives
	// both a dataset rebuild and a UI language change.
	private readonly seriesVisible = new Map<string, boolean>();

	private chart: Chart<'line'> | null = null;
	private detachPointer: (() => void) | null = null;
	private spec: TimelineChartSpec | null = null;
	private annotations: AnnotationSpec | null = null;
	private dirty = false;
	private visible = false;

	constructor(rootElem: HTMLElement) {
		this.options = {
			animation: false,
			responsive: true,
			maintainAspectRatio: false,
			parsing: false,
			normalized: true,
			interaction: { mode: 'nearest', axis: 'xy', intersect: false },
			scales: {},
			plugins: {
				legend: {
					position: 'top',
					onClick: (_event, item) => this.toggleSeries(item.datasetIndex),
				},
				tooltip: {
					enabled: false,
					external: context => this.tooltip.handle(context),
				},
			},
		};

		this.zoom = new ChartZoom(
			() => this.chart,
			() => this.options.scales?.x as XRange | undefined,
			dragging => {
				this.tooltip.suppressed = dragging;
				if (dragging) this.tooltip.hide();
			},
		);

		const canvasRef = ref<HTMLCanvasElement>();
		const wrapperRef = ref<HTMLDivElement>();
		const emptyRef = ref<HTMLDivElement>();

		rootElem.appendChild(
			<div className="timeline-chart">
				{ChartToolbar({
					reset: () => this.zoom.reset(),
					zoomIn: () => this.zoom.zoomBy(ZOOM_STEP),
					zoomOut: () => this.zoom.zoomBy(1 / ZOOM_STEP),
					panLeft: () => this.zoom.panBy(-PAN_STEP_PX),
					panRight: () => this.zoom.panBy(PAN_STEP_PX),
				})}
				<div ref={wrapperRef} className="timeline-chart-canvas">
					<canvas ref={canvasRef} attributes={{ role: 'img', 'aria-label': i18n.t('results_tab.details.timeline.chart_options.chart_label') }} />
				</div>
				<div ref={emptyRef} className="timeline-chart-empty hide">
					{i18n.t('results_tab.details.timeline.chart_options.waiting_for_data')}
				</div>
			</div>,
		);

		this.canvas = canvasRef.value!;
		this.canvasWrapper = wrapperRef.value!;
		this.emptyElem = emptyRef.value!;
	}

	render(spec: TimelineChartSpec | null) {
		this.spec = spec;
		this.dirty = true;
		if (this.visible) this.apply();
	}

	setVisible(visible: boolean) {
		this.visible = visible;
		if (!visible) {
			this.tooltip.hide();
			return;
		}
		if (this.dirty) this.apply();
		// The pane is display:none until now, so anything laid out earlier measured 0x0.
		this.chart?.resize();
	}

	dispose() {
		this.destroyChart();
		this.tooltip.dispose();
	}

	private apply() {
		this.dirty = false;
		const spec = this.spec;

		// chart.js has no noData equivalent and would draw a pair of empty axes.
		if (!spec || spec.datasets.length === 0) {
			this.destroyChart();
			this.canvasWrapper.classList.add('hide');
			this.emptyElem.classList.remove('hide');
			return;
		}

		this.canvasWrapper.classList.remove('hide');
		this.emptyElem.classList.add('hide');

		this.tooltip.invalidate();
		this.annotations = spec.annotations;
		this.options.scales = spec.scales;
		this.zoom.setDuration(spec.duration);
		this.zoom.write();
		for (const dataset of spec.datasets) dataset.hidden = !this.isSeriesVisible(dataset.seriesId);

		if (!this.chart) {
			this.createChart(spec);
			return;
		}
		this.chart.data.datasets = spec.datasets;
		this.chart.update('none');
	}

	private createChart(spec: TimelineChartSpec) {
		const config: ChartConfiguration<'line'> = {
			type: 'line',
			data: { datasets: spec.datasets },
			options: this.options,
			plugins: [annotationsPlugin(() => this.annotations), this.zoom.plugin()],
		};

		this.chart = new Chart(this.canvas, config);
		this.detachPointer = this.zoom.attach(this.canvas);
	}

	private toggleSeries(datasetIndex: number | undefined) {
		if (datasetIndex == null || !this.chart) return;
		const dataset = this.chart.data.datasets[datasetIndex] as TimelineDataset | undefined;
		if (!dataset) return;

		const next = !this.isSeriesVisible(dataset.seriesId);
		this.seriesVisible.set(dataset.seriesId, next);
		dataset.hidden = !next;
		this.chart.update('none');
	}

	// Threat is off by default in the single-player view - it is rarely what anyone opened
	// the chart for in MoP - but a legend click sticks for the rest of the session.
	private isSeriesVisible(seriesId: string): boolean {
		return this.seriesVisible.get(seriesId) ?? seriesId !== THREAT_SERIES_ID;
	}

	private destroyChart() {
		this.detachPointer?.();
		this.detachPointer = null;
		this.tooltip.hide();
		this.chart?.destroy();
		this.chart = null;
	}
}