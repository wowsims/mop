import { DistributionMetrics } from '@generated/proto/api';
import { TopGearResult } from '@sim/bulk/types';
import { describe, expect, it } from 'vitest';

import { buildTieChains } from './tie_chains';

const result = (avg: number, stdev: number, overrides: Partial<TopGearResult> = {}): TopGearResult =>
	({ gear: null, dpsMetrics: { avg, stdev } as DistributionMetrics, ...overrides }) as TopGearResult;

const shape = (chains: TopGearResult[][]) => chains.map(chain => chain.map(entry => entry.dpsMetrics.avg));

describe('buildTieChains', () => {
	it('keeps every result, in order, exactly once', () => {
		const results = [result(300, 1), result(200, 1), result(100, 1)];
		expect(shape(buildTieChains(results, null, 100))).toEqual([[300], [200], [100]]);
	});

	it('groups neighbours the unpaired z-test cannot separate', () => {
		// stdev 500 over 100 iterations is an error of 50 apiece, so a 10 DPS gap is noise and a
		// 1000 DPS gap is not.
		const results = [result(1010, 500), result(1000, 500), result(0, 500)];
		expect(shape(buildTieChains(results, null, 100))).toEqual([[1010, 1000], [0]]);
	});

	it('takes the tighter paired error against the baseline when the backend supplied one', () => {
		// Unpaired, these two are indistinguishable; the paired error of 1 says the difference is
		// real, and the pair involving the baseline is exactly where it applies.
		const baseline = result(1000, 500);
		const candidate = result(1010, 500, { backendRank: 0, pairedErrorToBaseline: 1 });
		expect(shape(buildTieChains([candidate, baseline], baseline, 100))).toEqual([[1010], [1000]]);
	});

	it('uses pairedErrorToNextResult only for results the backend ranked adjacently', () => {
		const adjacent = [result(1010, 500, { backendRank: 0, pairedErrorToNextResult: 1 }), result(1000, 500, { backendRank: 1 })];
		expect(shape(buildTieChains(adjacent, null, 100))).toEqual([[1010], [1000]]);

		// Same numbers, but the backend ranked them two apart — the paired error does not describe
		// this pair, so the unpaired test answers and calls them tied.
		const separated = [result(1010, 500, { backendRank: 0, pairedErrorToNextResult: 1 }), result(1000, 500, { backendRank: 2 })];
		expect(shape(buildTieChains(separated, null, 100))).toEqual([[1010, 1000]]);
	});

	it('chains transitively through neighbours', () => {
		// A ties B and B ties C, while A and C are far enough apart to separate on their own.
		const results = [result(200, 500), result(150, 500), result(100, 500)];
		expect(shape(buildTieChains(results, null, 100))).toEqual([[200, 150, 100]]);
	});

	it('is empty for no results', () => {
		expect(buildTieChains([], null, 100)).toEqual([]);
	});
});
