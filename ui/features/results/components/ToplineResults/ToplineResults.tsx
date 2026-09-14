import { useSim } from '@sim/context/SimHostContext';
import { useDisplayMetrics } from '@sim/hooks/useDisplayMetrics';
import { useMemo } from 'react';

import { useSimResult } from '../../hooks/useSimResult';
import { showsOutOfMana, toplineResultMetrics } from '../../model/topline_metrics';
import { ResultMetricList } from '../ResultMetricList';

export const ToplineResults = () => {
	const resultData = useSimResult();
	const displayMetrics = useDisplayMetrics(useSim());

	const metrics = useMemo(() => {
		if (!resultData) return null;
		const { result, filter } = resultData;

		return toplineResultMetrics(result, filter, { showOutOfMana: showsOutOfMana(result, filter), displayMetrics });
	}, [resultData, displayMetrics]);

	return (
		<div className="topline-results-root results-sim text-center pb-6 [&_.metrics-table]:w-full [&_.metrics-table]:max-w-full [&_.metrics-table]:table-fixed [&_.metrics-table-header-row]:border-b-0 [&_.metrics-table-body_tr]:border-b-0 [&_.metrics-table-body_tr:hover]:bg-transparent">
			{metrics && <ResultMetricList metrics={metrics} layout="row" />}
		</div>
	);
};
