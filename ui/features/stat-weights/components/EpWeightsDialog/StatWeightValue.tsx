import { stDevToConf90 } from '@domain/math';
import { Icon } from '@ui-kit/Icon';
import clsx from 'clsx';

export interface StatWeightValueProps {
	value: number;
	stdev: number;
	iterations: number;
	className?: string;
}

export const StatWeightValue = ({ value, stdev, iterations, className }: StatWeightValueProps) => (
	<>
		<span className={clsx('results-avg', className)}>{value.toFixed(2)}</span>
		<span className="results-stdev">
			{'('}
			<Icon name="plus-minus" size="xs" />
			{stDevToConf90(stdev, iterations).toFixed(2)}
			{')'}
		</span>
	</>
);
