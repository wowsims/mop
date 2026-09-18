import { Tooltip } from '@ui-kit/Tooltip';
import type { ReactNode } from 'react';

export interface MetricTooltipProps<T> {
	id: string;
	/** A `metricForAnchor` reader, bound to the table's metrics. */
	forAnchor: (anchor: Element | null, build: (metric: T) => ReactNode) => ReactNode;
	body: (metric: T) => ReactNode;
}

/** One column's `<Tooltip>`: the chrome every metrics-table tooltip shares, with the per-row body left to the caller. */
export const MetricTooltip = <T,>({ id, forAnchor, body }: MetricTooltipProps<T>) => (
	<Tooltip
		id={id}
		className="ui-metrics-tooltip text-xs"
		maxWidth="max-w-none max-sm:max-w-metrics-tooltip"
		render={({ activeAnchor }) => forAnchor(activeAnchor, body)}
	/>
);
