import { describe, expect, it } from 'vitest';

import { buildMetricRows, compareMetricValues, type MetricGrouping } from './grouping';

interface Metric {
	name: string;
	pet: boolean;
}

const metric = (name: string, pet = false): Metric => ({ name, pet });

const grouping = (shouldCollapse: (metric: Metric) => boolean): MetricGrouping<Metric> => ({
	merge: metrics => metric(metrics[0].pet ? 'Pet' : metrics[0].name, metrics[0].pet),
	shouldCollapse,
});

describe('buildMetricRows', () => {
	it('drops empty groups', () => {
		expect(
			buildMetricRows(
				[[], [metric('a')], []],
				grouping(() => true),
			),
		).toEqual([{ metric: metric('a') }]);
	});

	it('collapses a single-element group to a plain row', () => {
		const rows = buildMetricRows(
			[[metric('a')]],
			grouping(() => true),
		);
		expect(rows).toEqual([{ metric: metric('a') }]);
		expect(rows[0].subRows).toBeUndefined();
	});

	it('keeps the parent row of a single-element group `shouldCollapse` rejects', () => {
		const rows = buildMetricRows(
			[[metric('Bite', true)]],
			grouping(single => !single.pet),
		);
		expect(rows).toHaveLength(1);
		expect(rows[0].metric.name).toBe('Pet');
		expect(rows[0].subRows).toEqual([{ metric: metric('Bite', true) }]);
	});

	it('merges a group of more than one into a parent with every member as a child', () => {
		const rows = buildMetricRows(
			[[metric('Bite', true), metric('Claw', true)]],
			grouping(() => true),
		);
		expect(rows[0].metric.name).toBe('Pet');
		expect(rows[0].subRows?.map(row => row.metric.name)).toEqual(['Bite', 'Claw']);
	});
});

describe('compareMetricValues', () => {
	it('subtracts two numbers', () => {
		expect(compareMetricValues(2, 5)).toBeLessThan(0);
		expect(compareMetricValues(5, 2)).toBeGreaterThan(0);
		expect(compareMetricValues(5, 5)).toBe(0);
	});

	it('compares anything else as a locale-aware string', () => {
		expect(compareMetricValues('apple', 'Banana')).toBe('apple'.localeCompare('Banana'));
		expect(compareMetricValues('apple', 2)).toBe('apple'.localeCompare('2'));
	});

	it('treats a NaN difference as equal rather than returning NaN', () => {
		expect(compareMetricValues(NaN, 5)).toBe(0);
		expect(compareMetricValues(5, NaN)).toBe(0);
	});
});
