import './DpsHistogram.scss';

import i18n from '@i18n/config';
import type { ChartData, ChartOptions } from 'chart.js';
import { useMemo } from 'react';
import { Bar } from 'react-chartjs-2';

import { useSimResult } from '../../hooks/useSimResult';

const IN_STDEV = '#1E87F0';
const OUT_OF_STDEV = '#FF6961';

export const DpsHistogram = () => {
	const resultData = useSimResult();

	const data = useMemo<ChartData<'bar', Array<number>, string> | null>(() => {
		if (!resultData) return null;

		const damageMetrics = resultData.result.getDamageMetrics(resultData.filter);
		const min = damageMetrics.avg - damageMetrics.stdev;
		const max = damageMetrics.avg + damageMetrics.stdev;
		const labels = Object.keys(damageMetrics.hist);

		return {
			labels,
			datasets: [
				{
					data: labels.map(label => damageMetrics.hist[Number(label)]),
					backgroundColor: labels.map(label => (parseInt(label) > min && parseInt(label) < max ? IN_STDEV : OUT_OF_STDEV)),
				},
			],
		};
	}, [resultData]);

	const options = useMemo<ChartOptions<'bar'>>(
		() => ({
			responsive: true,
			maintainAspectRatio: false,
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
		}),
		[],
	);

	return <div className="dps-histogram-root">{data && <Bar data={data} options={options} />}</div>;
};
