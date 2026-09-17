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
		<div
			data-testid="topline-results-root"
			className="pb-6 text-center [&_.ui-metrics-header-row]:border-b-0 [&_.ui-metrics-row]:border-b-0 [&_.ui-metrics-row:hover]:bg-transparent [&_.ui-metrics-table]:w-full [&_.ui-metrics-table]:max-w-full [&_.ui-metrics-table]:table-fixed">
			{metrics && <ResultMetricList metrics={metrics} layout="row" />}
		</div>
	);
};
