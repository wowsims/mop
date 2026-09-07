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

/** A row's identity, passed to the table as `getRowId` and reused by `indexMetricRows`, so the two cannot drift. */
export const metricRowId = (index: number, parentId?: string): string => (parentId === undefined ? String(index) : `${parentId}.${index}`);

/** The map a column-wide tooltip resolves its anchor against: the `data-row-id` on the hovered cell back to the metric that cell was built from. */
export const indexMetricRows = <T>(rows: Array<MetricRow<T>>): Map<string, T> => {
	const byId = new Map<string, T>();
	const walk = (list: Array<MetricRow<T>>, parentId?: string) =>
		list.forEach((row, index) => {
			const id = metricRowId(index, parentId);
			byId.set(id, row.metric);
			if (row.subRows) walk(row.subRows, id);
		});
	walk(rows);
	return byId;
};

/** `TableSorter.sortFunc`, ascending — the sorted row model negates it for a descending column. */
export const compareMetricValues = (a: unknown, b: unknown): number => {
	if (typeof a === 'number' && typeof b === 'number') {
		const difference = a - b;
		return Number.isNaN(difference) ? 0 : difference;
	}
	return String(a).localeCompare(String(b));
};
