import type { StatWeightValues } from '@generated/proto/api';
import i18n from '@i18n/config';
import type { UnitStat } from '@sim/proto/stats';
import { toneTextClass } from '@ui-kit/utils/css';
import clsx from 'clsx';

import { StatWeightValue } from './StatWeightValue';

export interface StatWeightCellsProps {
	stat: UnitStat;
	statWeights?: StatWeightValues;
	iterations: number;
	epRatio: number;
	epDelta: number;
	cellClassName: string;
}

const NotApplicable = () => (
	<span data-testid="results-avg" data-notapplicable className="pr-6.25 font-bold">
		{i18n.t('sidebar.buttons.stat_weights.modal.not_applicable')}
	</span>
);

export const StatWeightCells = ({ stat, statWeights, iterations, epRatio, epDelta, cellClassName }: StatWeightCellsProps) => {
	const unused = !!statWeights && epRatio === 0;
	const rounded = epDelta.toFixed(2);
	const delta = !statWeights || unused || rounded === '0.00' ? undefined : epDelta > 0 ? 'positive' : 'negative';

	return (
		<>
			<td
				data-testid="stdev-cell"
				data-column-type="weight"
				className={clsx('text-right in-data-[stats-type=ep]:hidden', cellClassName, unused && 'text-white/70')}
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
				data-testid="stdev-cell"
				data-column-type="ep"
				className={clsx('text-right in-data-[stats-type=weight]:hidden', cellClassName, unused && 'text-white/70')}
				data-unused={unused ? '' : undefined}>
				{statWeights ? (
					<StatWeightValue
						value={stat.getProtoValue(statWeights.epValues!)}
						stdev={stat.getProtoValue(statWeights.epValuesStdev!)}
						iterations={iterations}
						className={toneTextClass(delta)}
						sign={delta}
					/>
				) : (
					<NotApplicable />
				)}
			</td>
		</>
	);
};
