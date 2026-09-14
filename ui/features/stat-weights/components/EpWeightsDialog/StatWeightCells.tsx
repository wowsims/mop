import type { UnitStat } from '@sim/proto/stats';
import type { StatWeightValues } from '@generated/proto/api';
import i18n from '@i18n/config';
import clsx from 'clsx';

import { StatWeightValue } from './StatWeightValue';

const HIDE_VARIANT: Record<string, string> = {
	'damage-metrics': 'in-data-[hide-damage]:hidden',
	'healing-metrics': 'in-data-[hide-healing]:hidden',
	'threat-metrics': 'in-data-[hide-threat]:hidden',
};

export interface StatWeightCellsProps {
	stat: UnitStat;
	statWeights?: StatWeightValues;
	metricClass: string;
	iterations: number;
	epRatio: number;
	epDelta: number;
	cellClassName: string;
}

const NotApplicable = () => (
	<span className="results-avg notapplicable pr-[25px] font-bold">{i18n.t('sidebar.buttons.stat_weights.modal.not_applicable')}</span>
);

export const StatWeightCells = ({ stat, statWeights, metricClass, iterations, epRatio, epDelta, cellClassName }: StatWeightCellsProps) => {
	const unused = !!statWeights && epRatio === 0;
	const rounded = epDelta.toFixed(2);
	const delta = !statWeights || unused || rounded === '0.00' ? undefined : epDelta > 0 ? 'positive' : 'negative';

	return (
		<>
			<td
				className={clsx('stdev-cell type-weight text-right in-data-[stats-type=ep]:hidden', cellClassName, unused && 'text-gray-500', metricClass, HIDE_VARIANT[metricClass])}
				data-unused={unused ? '' : undefined}>
				{statWeights ? (
					<StatWeightValue
						value={stat.getProtoValue(statWeights.weights!)}
						stdev={stat.getProtoValue(statWeights.weightsStdev!)}
						iterations={iterations}
					/>
				) : (
					<NotApplicable />
				)}
			</td>
			<td
				className={clsx('stdev-cell type-ep text-right in-data-[stats-type=weight]:hidden', cellClassName, unused && 'text-gray-500', metricClass, HIDE_VARIANT[metricClass])}
				data-unused={unused ? '' : undefined}>
				{statWeights ? (
					<StatWeightValue
						value={stat.getProtoValue(statWeights.epValues!)}
						stdev={stat.getProtoValue(statWeights.epValuesStdev!)}
						iterations={iterations}
						className={delta}
						sign={delta}
					/>
				) : (
					<NotApplicable />
				)}
			</td>
		</>
	);
};
