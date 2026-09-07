export interface MetricRow<T> {
	metric: T;
	subRows?: Array<MetricRow<T>>;
}

export interface MetricGrouping<T> {
	merge: (metrics: Array<T>) => T;
	shouldCollapse: (metric: T) => boolean;
}

export const buildMetricRows = <T>(groups: Array<Array<T>>, { merge, shouldCollapse }: MetricGrouping<T>): Array<MetricRow<T>> =>
	groups
		.filter(group => group.length > 0)
		.map(group =>
			group.length === 1 && shouldCollapse(group[0]) ? { metric: group[0] } : { metric: merge(group), subRows: group.map(metric => ({ metric })) },
		);

/** `TableSorter.sortFunc`, ascending — the sorted row model negates it for a descending column. */
export const compareMetricValues = (a: unknown, b: unknown): number => {
	if (typeof a === 'number' && typeof b === 'number') {
		const difference = a - b;
		return Number.isNaN(difference) ? 0 : difference;
	}
	return String(a).localeCompare(String(b));
};
