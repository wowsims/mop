import type { UnitStat } from '@domain/proto_utils/stats';
import type { StatWeightValues } from '@generated/proto/api';
import i18n from '@i18n/config';
import clsx from 'clsx';

import { StatWeightValue } from './StatWeightValue';

export interface StatWeightCellsProps {
	stat: UnitStat;
	statWeights?: StatWeightValues;
	metricClass: string;
	iterations: number;
	epRatio: number;
	epDelta: number;
}

const notApplicable = () => <span className="results-avg notapplicable">{i18n.t('sidebar.buttons.stat_weights.modal.not_applicable')}</span>;

export const StatWeightCells = ({ stat, statWeights, metricClass, iterations, epRatio, epDelta }: StatWeightCellsProps) => {
	const unused = !!statWeights && epRatio === 0;
	const rounded = epDelta.toFixed(2);
	const delta = !statWeights || unused || rounded === '0.00' ? undefined : epDelta > 0 ? 'positive' : 'negative';

	return (
		<>
			<td className={clsx('stdev-cell', 'type-weight', unused && 'unused-ep', metricClass)}>
				{statWeights ? (
					<StatWeightValue
						value={stat.getProtoValue(statWeights.weights!)}
						stdev={stat.getProtoValue(statWeights.weightsStdev!)}
						iterations={iterations}
					/>
				) : (
					notApplicable()
				)}
			</td>
			<td className={clsx('stdev-cell', 'type-ep', unused && 'unused-ep', metricClass)}>
				{statWeights ? (
					<StatWeightValue
						value={stat.getProtoValue(statWeights.epValues!)}
						stdev={stat.getProtoValue(statWeights.epValuesStdev!)}
						iterations={iterations}
						className={delta}
					/>
				) : (
					notApplicable()
				)}
			</td>
		</>
	);
};
