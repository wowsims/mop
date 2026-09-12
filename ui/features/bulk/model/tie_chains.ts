import type { TopGearResult } from '@sim/bulk/types';
import { Z_95, zTest } from '@sim/utils/math';

/**
 * Whether two adjacent results are indistinguishable, which decides where the results table draws a
 * "tied" bracket.
 *
 * Two errors are available and they answer different questions. The backend returns a *paired*
 * error — the error of the difference between two runs that shared their random seeds, which is far
 * tighter than either run's own — but only for the pairs it actually compared: each result against
 * the baseline, and each result against the one ranked immediately below it. Anywhere else, or
 * where the backend returned nothing, this falls back to an unpaired two-sample z-test on the two
 * means, which is the honest answer for two runs that share no seed.
 *
 * `backendRank` is what makes "immediately below" mean the backend's order rather than the display
 * order: the two differ, because the baseline row is spliced in and everything is re-sorted by DPS.
 */
const pairTied = (upper: TopGearResult, lower: TopGearResult, baseline: TopGearResult | null, iterations: number): boolean => {
	let pairedError: number | undefined;
	if (upper === baseline) {
		pairedError = lower.pairedErrorToBaseline;
	} else if (lower === baseline) {
		pairedError = upper.pairedErrorToBaseline;
	} else if (upper.backendRank !== undefined && lower.backendRank === upper.backendRank + 1) {
		pairedError = upper.pairedErrorToNextResult;
	}
	if (pairedError) {
		return Math.abs(upper.dpsMetrics.avg - lower.dpsMetrics.avg) <= Z_95 * pairedError;
	}
	return !zTest(iterations, upper.dpsMetrics.avg, upper.dpsMetrics.stdev, iterations, lower.dpsMetrics.avg, lower.dpsMetrics.stdev).isDiff;
};

/**
 * The results split into runs of adjacent rows that cannot be told apart. Every result appears in
 * exactly one chain and the order is preserved, so a chain of one is an ordinary row and a chain of
 * more than one is a bracket. Adjacency is deliberately transitive-by-neighbour rather than
 * all-pairs: A ties B and B ties C puts all three in one chain even where A and C would separate,
 * which is what "the table cannot order these" means for a ranked list.
 */
export const buildTieChains = (results: readonly TopGearResult[], baseline: TopGearResult | null, iterations: number): TopGearResult[][] => {
	const chains: TopGearResult[][] = [];
	for (const result of results) {
		const currentChain = chains[chains.length - 1];
		const previousResult = currentChain?.[currentChain.length - 1];
		if (previousResult && pairTied(previousResult, result, baseline, iterations)) {
			currentChain.push(result);
		} else {
			chains.push([result]);
		}
	}
	return chains;
};
