import { useRef } from 'react';

import type { MetricRow } from '../../model/grouping';

/** The bar denominator, held in a ref so a new result moves it without rebuilding the column defs. `null`, never `Math.max(...[])`, when a run yields no rows. */
export const useMetricMax = <T>(rows: Array<MetricRow<T>>, of: (metric: T) => number) => {
	const max = rows.length ? Math.max(...rows.map(row => of(row.metric))) : null;
	const ref = useRef(max);
	ref.current = max;
	return ref;
};
