import i18n from '@i18n/config';
import type { CombatLog } from '@sim/proto/combat_log';
import { Chart, type ChartOptions } from 'chart.js';
import clsx from 'clsx';
import { useEffect, useRef } from 'react';

import { useHoverTooltip } from '../../../hooks/useHoverTooltip';
import { annotationsPlugin } from '../../../view/timeline/chart/annotations';
import { THREAT_SERIES_ID } from '../../../view/timeline/chart/series';
import type { AnnotationSpec, TimelineChartSpec, TimelineDataset, TimelinePoint, TooltipSpec } from '../../../view/timeline/chart/types';
import { ChartZoom, type XRange } from '../../../view/timeline/chart/zoom';
import { ChartSeriesTooltip } from './ChartSeriesTooltip';
import { ChartToolbar } from './ChartToolbar';

const PAN_STEP_PX = 60;
const ZOOM_STEP = 1.2;

export interface TimelineChartProps {
	/** Null until the DPS view has been opened: building the series costs a pass over every log the unit kept. */
	spec: TimelineChartSpec | null;
}

export const TimelineChart = ({ spec }: TimelineChartProps) => {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const chartRef = useRef<Chart<'line'> | null>(null);
	const annotations = useRef<AnnotationSpec | null>(null);
	// Keyed by the stable series id, not by dataset index or legend label, so a toggle survives both a
	// dataset rebuild and a UI language change.
	const seriesVisible = useRef(new Map<string, boolean>());
	// datasetIndex + dataIndex, which a new result can reuse for a different log, so a rebuild clears it.
	const tipKey = useRef('');
	const suppressed = useRef(false);

	const { ref: tooltipRef, content: tip, show: showTip, moveTo: moveTip, hide: hideTip } = useHoverTooltip<{ spec: TooltipSpec; log: CombatLog }>();

	const isSeriesVisible = (seriesId: string) => seriesVisible.current.get(seriesId) ?? seriesId !== THREAT_SERIES_ID;

	// The one raw options object the chart is configured with. chart.js replaces its `scales` in place
	// on every update, so this reference — not `chart.options`, which is a resolver proxy — is what the
	// scales and the zoom range have to be written through.
	const options = useRef<ChartOptions<'line'>>(undefined as never);
	if (!options.current) {
		options.current = {
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
					// Threat is off by default in the single-player view — it is rarely what anyone opened
					// the chart for in MoP — but a legend click sticks for the rest of the session.
					onClick: (_event, item) => {
						const chart = chartRef.current;
						const dataset = item.datasetIndex == null ? undefined : (chart?.data.datasets[item.datasetIndex] as TimelineDataset | undefined);
						if (!chart || !dataset) return;
						const next = !isSeriesVisible(dataset.seriesId);
						seriesVisible.current.set(dataset.seriesId, next);
						dataset.hidden = !next;
						chart.update('none');
					},
				},
				tooltip: {
					enabled: false,
					external: context => {
						const { chart, tooltip } = context;
						if (suppressed.current || tooltip.opacity === 0 || !tooltip.dataPoints?.length) {
							tipKey.current = '';
							hideTip();
							return;
						}
						const rect = chart.canvas.getBoundingClientRect();
						const x = rect.left + tooltip.caretX;
						const y = rect.top + tooltip.caretY;
						const key = tooltip.dataPoints.map(point => `${point.datasetIndex}:${point.dataIndex}`).join(',');
						if (key === tipKey.current) {
							moveTip(x, y);
							return;
						}
						tipKey.current = key;
						const point = tooltip.dataPoints[0];
						const dataset = chart.data.datasets[point.datasetIndex] as TimelineDataset | undefined;
						const raw = point.raw as TimelinePoint | undefined;
						if (dataset && raw?.log) showTip({ spec: dataset.tooltipSpec, log: raw.log }, x, y);
						else hideTip();
					},
				},
			},
		};
	}

	const zoom = useRef<ChartZoom>(undefined as never);
	if (!zoom.current) {
		zoom.current = new ChartZoom(
			() => chartRef.current,
			() => options.current.scales?.x as XRange | undefined,
			dragging => {
				suppressed.current = dragging;
				if (dragging) {
					tipKey.current = '';
					hideTip();
				}
			},
		);
	}

	// chart.js has no noData equivalent and would draw a pair of empty axes. Before the first spec
	// there is nothing to say either way, so the canvas simply stands empty.
	const hasData = !!spec && spec.datasets.length > 0;
	const noData = !!spec && !hasData;

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!spec || !hasData || !canvas) return;

		annotations.current = spec.annotations;
		options.current.scales = spec.scales;
		zoom.current.setDuration(spec.duration);
		zoom.current.write();
		for (const dataset of spec.datasets) dataset.hidden = !isSeriesVisible(dataset.seriesId);

		const chart = new Chart(canvas, {
			type: 'line',
			data: { datasets: spec.datasets },
			options: options.current,
			plugins: [annotationsPlugin(() => annotations.current), zoom.current.plugin()],
		});
		chartRef.current = chart;
		const detach = zoom.current.attach(canvas);

		return () => {
			detach();
			chartRef.current = null;
			tipKey.current = '';
			hideTip();
			chart.destroy();
		};
		// oxlint-disable-next-line react-hooks/exhaustive-deps
	}, [spec, hasData]);

	return (
		<div className="timeline-chart">
			<ChartToolbar
				onReset={() => zoom.current.reset()}
				onZoomIn={() => zoom.current.zoomBy(ZOOM_STEP)}
				onZoomOut={() => zoom.current.zoomBy(1 / ZOOM_STEP)}
				onPanLeft={() => zoom.current.panBy(-PAN_STEP_PX)}
				onPanRight={() => zoom.current.panBy(PAN_STEP_PX)}
			/>
			<div className={clsx('timeline-chart-canvas', noData && 'hide')}>
				<canvas ref={canvasRef} role="img" aria-label={i18n.t('results_tab.details.timeline.chart_options.chart_label')} />
			</div>
			<div className={clsx('timeline-chart-empty', !noData && 'hide')}>{i18n.t('results_tab.details.timeline.chart_options.waiting_for_data')}</div>
			{tip && (
				<div ref={tooltipRef} className="timeline-hover-tooltip">
					<ChartSeriesTooltip spec={tip.spec} log={tip.log} />
				</div>
			)}
		</div>
	);
};
