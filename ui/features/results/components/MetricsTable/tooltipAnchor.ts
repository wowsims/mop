import type { ReactNode } from 'react';

/** The reader for the `data-row-id` `MetricsTableRow` writes: it turns a column-wide `<Tooltip>`'s active anchor back into the metric its cell was built from. */
export const metricForAnchor =
	<T>(byRowId: Map<string, T>) =>
	(anchor: Element | null, build: (metric: T) => ReactNode): ReactNode => {
		const metric = byRowId.get(anchor?.getAttribute('data-row-id') ?? '');
		return metric ? build(metric) : null;
	};
