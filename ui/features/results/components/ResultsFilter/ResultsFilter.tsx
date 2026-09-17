import { UnitPicker } from '@ui-kit/UnitPicker';
import { useMemo } from 'react';

import { useSimResult } from '../../hooks/useSimResult';
import { numToRef, refToNum, unitOptions } from './utils';

export interface ResultsFilterProps {
	/** `ALL_UNITS`, or the encounter index of one target. */
	target: number;
	onTargetChange: (target: number) => void;
}

/**
 * The detailed-results toolbar's target filter. It owns the option list, which only exists once a
 * run has produced targets; the selection itself belongs to the pane, because the pane is what
 * re-emits the result every table reads through it.
 */
export const ResultsFilter = ({ target, onTargetChange }: ResultsFilterProps) => {
	const resultData = useSimResult();
	const options = useMemo(() => (resultData ? unitOptions(resultData.result) : []), [resultData]);

	return (
		<div data-testid="results-filter-root" className="flex items-center text-lg">
			<UnitPicker
				id="results-filter-target-filter"
				className={['mb-0', !resultData && 'hidden']}
				options={options}
				value={numToRef(target)}
				onChange={ref => onTargetChange(refToNum(ref))}
			/>
		</div>
	);
};
