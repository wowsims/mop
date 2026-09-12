import i18n from '@i18n/config';
import type { CombatLog } from '@sim/proto/combat_log';
import type { Chart as ChartJS, ChartData, ChartOptions, Plugin } from 'chart.js';
import { useEffect, useMemo, useRef } from 'react';
import { Chart } from 'react-chartjs-2';

import { useHoverTooltip } from '../../../hooks/useHoverTooltip';
import type { AnnotationSpec, TimelineChartSpec, TimelineDataset, TimelinePoint, TooltipSpec } from '../../../model/timeline/chart/types';
import { annotationsPlugin } from './annotations';
import { ChartSeriesTooltip } from './ChartSeriesTooltip';
import { ChartToolbar } from './ChartToolbar';
import { THREAT_SERIES_ID } from './series';
import { ChartZoom } from './zoom';

const PAN_STEP_PX = 60;
const ZOOM_STEP = 1.2;

export interface TimelineChartProps {
	/** Null until the DPS view has been opened: building the series costs a pass over every log the unit kept. */
	spec: TimelineChartSpec | null;
}

export const TimelineChart = ({ spec }: TimelineChartProps) => {
	const chartRef = useRef<ChartJS<'line'> | undefined>(undefined);
	const annotations = useRef<AnnotationSpec | null>(null);
	// Keyed by the stable series id, not by dataset index or legend label, so a toggle survives both a
	// dataset rebuild and a UI language change.
	const seriesVisible = useRef(new Map<string, boolean>());
	// datasetIndex + dataIndex, which a new result can reuse for a different log, so a rebuild clears it.
	const tipKey = useRef('');
	const suppressed = useRef(false);

	const { ref: tooltipRef, content: tip, show: showTip, moveTo: moveTip, hide: hideTip } = useHoverTooltip<{ spec: TooltipSpec; log: CombatLog }>();

	const isSeriesVisible = (seriesId: string) => seriesVisible.current.get(seriesId) ?? seriesId !== THREAT_SERIES_ID;

	// Everything about the chart except its scales, which are the only part a new result changes.
	// Held rather than rebuilt so react-chartjs-2's options effect fires once per result, not per render.
	const behaviour = useRef<ChartOptions<'line'>>(undefined as never);
	if (!behaviour.current) {
		behaviour.current = {
			animation: false,
			responsive: true,
			maintainAspectRatio: false,
			parsing: false,
			normalized: true,
			interaction: { mode: 'nearest', axis: 'xy', intersect: false },
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
			() => chartRef.current ?? null,
			dragging => {
				suppressed.current = dragging;
				if (dragging) {
					tipKey.current = '';
					hideTip();
				}
			},
		);
	}

	const plugins = useRef<Array<Plugin<'line'>>>(undefined as never);
	if (!plugins.current) plugins.current = [annotationsPlugin(() => annotations.current), zoom.current.plugin()];

	// chart.js has no noData equivalent and would draw a pair of empty axes. Before the first spec
	// there is nothing to say either way, so the canvas simply stands empty.
	const hasData = !!spec && spec.datasets.length > 0;
	const noData = !!spec && !hasData;

	// Written here rather than from an effect: a child's effects run before its parent's, and the one
	// react-chartjs-2 updates the chart from draws synchronously, so an effect would paint the new
	// result's series under the previous result's cooldown bands.
	annotations.current = spec?.annotations ?? null;
	if (spec) for (const dataset of spec.datasets) dataset.hidden = !isSeriesVisible(dataset.seriesId);

	const data = useMemo<ChartData<'line', Array<TimelinePoint>>>(() => ({ datasets: spec?.datasets ?? [] }), [spec]);
	const options = useMemo<ChartOptions<'line'>>(() => ({ ...behaviour.current, scales: spec?.scales ?? {} }), [spec]);

	useEffect(() => {
		if (spec) zoom.current.setDuration(spec.duration);
	}, [spec]);

	return (
		<div className="timeline-chart">
			<ChartToolbar
				onReset={() => zoom.current.reset()}
				onZoomIn={() => zoom.current.zoomBy(ZOOM_STEP)}
				onZoomOut={() => zoom.current.zoomBy(1 / ZOOM_STEP)}
				onPanLeft={() => zoom.current.panBy(-PAN_STEP_PX)}
				onPanRight={() => zoom.current.panBy(PAN_STEP_PX)}
			/>
			{!noData && (
				<div className="timeline-chart-canvas">
					{hasData && (
						<Chart
							type="line"
							ref={chartRef}
							data={data}
							options={options}
							plugins={plugins.current}
							// react-chartjs-2 otherwise matches a new result's datasets to the old ones by
							// `label`, which is translated and can collide; `seriesId` is the stable key.
							datasetIdKey="seriesId"
							updateMode="none"
							aria-label={i18n.t('results_tab.details.timeline.chart_options.chart_label')}
							onPointerDown={event => zoom.current.down(event)}
							onPointerMove={event => zoom.current.move(event)}
							onPointerUp={event => zoom.current.up(event)}
							onPointerCancel={event => zoom.current.cancel(event)}
						/>
					)}
				</div>
			)}
			{noData && <div className="timeline-chart-empty">{i18n.t('results_tab.details.timeline.chart_options.waiting_for_data')}</div>}
			{tip && (
				<div ref={tooltipRef} className="timeline-hover-tooltip">
					<ChartSeriesTooltip spec={tip.spec} log={tip.log} />
				</div>
			)}
		</div>
	);
};
