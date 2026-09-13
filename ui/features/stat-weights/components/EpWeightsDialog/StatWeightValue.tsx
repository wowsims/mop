import { stDevToConf90 } from '@sim/utils/math';
import { Icon } from '@ui-kit/Icon';
import clsx from 'clsx';

export interface StatWeightValueProps {
	value: number;
	stdev: number;
	iterations: number;
	className?: string;
	sign?: 'positive' | 'negative';
}

export const StatWeightValue = ({ value, stdev, iterations, className, sign }: StatWeightValueProps) => (
	<>
		<span className={clsx('results-avg', className)} data-sign={sign}>
			{value.toFixed(2)}
		</span>
		<span className="results-stdev text-2xs">
			{'('}
			<Icon name="plus-minus" size="xs" />
			{stDevToConf90(stdev, iterations).toFixed(2)}
			{')'}
		</span>
	</>
);
