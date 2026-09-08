import './DpsHistogram.scss';

import i18n from '@i18n/config';
import { Chart } from 'chart.js';
import { useEffect, useRef } from 'react';

import { useSimResult } from '../../hooks/useSimResult';

const IN_STDEV = '#1E87F0';
const OUT_OF_STDEV = '#FF6961';

export const DpsHistogram = () => {
	const resultData = useSimResult();
	const rootRef = useRef<HTMLDivElement>(null);

	// Chart.js owns the canvas, so the canvas is built here rather than rendered; the root div is React's.
	useEffect(() => {
		const root = rootRef.current;
		if (!resultData || !root) return;

		const chartBounds = root.getBoundingClientRect();
		const chartCanvas = document.createElement('canvas');
		chartCanvas.height = chartBounds.height;
		chartCanvas.width = chartBounds.width;

		const damageMetrics = resultData.result.getDamageMetrics(resultData.filter);

		const min = damageMetrics.avg - damageMetrics.stdev;
		const max = damageMetrics.avg + damageMetrics.stdev;
		const vals: Array<number> = [];
		const colors: Array<string> = [];

		const labels = Object.keys(damageMetrics.hist);
		labels.forEach(k => {
			vals.push(damageMetrics.hist[Number(k)]);
			const val = parseInt(k);
			colors.push(val > min && val < max ? IN_STDEV : OUT_OF_STDEV);
		});

		const ctx = chartCanvas.getContext('2d')!;
		root.replaceChildren(chartCanvas);

		const chart = new Chart(ctx, {
			type: 'bar',
			data: {
				labels: labels,
				datasets: [
					{
						data: vals,
						backgroundColor: colors,
					},
				],
			},
			options: {
				plugins: {
					title: {
						display: true,
						text: i18n.t('results_tab.details.damage.dps_histogram'),
					},
					legend: {
						display: false,
						labels: {},
					},
				},
				scales: {
					y: {
						beginAtZero: true,
						ticks: {
							display: false,
						},
					},
				},
			},
		});

		return () => {
			chart.destroy();
			root.replaceChildren();
		};
	}, [resultData]);

	return <div className="dps-histogram-root" ref={rootRef} />;
};
