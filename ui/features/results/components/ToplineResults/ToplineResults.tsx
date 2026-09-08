import './ToplineResults.scss';

import { useMemo } from 'react';

import { useSimResult } from '../../hooks/useSimResult';
import { showsOutOfMana, toplineResultMetrics } from '../../model/topline_metrics';
import { ResultMetricList } from '../ResultMetricList';

export const ToplineResults = () => {
	const resultData = useSimResult();

	const metrics = useMemo(() => {
		if (!resultData) return null;
		const { result, filter } = resultData;

		return toplineResultMetrics(result, filter, { showOutOfMana: showsOutOfMana(result, filter) });
	}, [resultData]);

	return <div className="topline-results-root results-sim">{metrics && <ResultMetricList metrics={metrics} layout="row" />}</div>;
};
