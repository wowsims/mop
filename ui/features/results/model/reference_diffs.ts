import type { SimResult } from '@sim/proto/sim_result';
import { type DeltaText, formatDeltaText, formatSignificance } from '@sim/utils/format';
import { zTest } from '@sim/utils/math';
import type { DistributionMetrics } from '@generated/proto/api';

import type { ResultMetrics } from './sim_results';

export type ReferenceDiff = DeltaText & { significance: string };

export type ReferenceDiffs = Partial<Record<keyof ResultMetrics, ReferenceDiff>>;

// dps and hps are read off the raid where every other metric is read off the first player, which is
// what the panel has always compared; `dur` and `oom` carry no delta at all.
const COMPARED: Array<{
	metric: keyof ResultMetrics;
	read: (result: SimResult) => DistributionMetrics;
	lowerIsBetter?: boolean;
	preNormalizedErrors?: boolean;
}> = [
	{ metric: 'dps', read: result => result.raidMetrics.dps },
	{ metric: 'hps', read: result => result.raidMetrics.hps },
	{ metric: 'tto', read: result => result.getFirstPlayer()!.tto },
	{ metric: 'tps', read: result => result.getFirstPlayer()!.tps },
	{ metric: 'dtps', read: result => result.getFirstPlayer()!.dtps, lowerIsBetter: true },
	{ metric: 'tmi', read: result => result.getFirstPlayer()!.tmi, lowerIsBetter: true },
	{ metric: 'cod', read: result => result.getFirstPlayer()!.chanceOfDeath, lowerIsBetter: true, preNormalizedErrors: true },
];

export const referenceDiffs = (current: SimResult, reference: SimResult): ReferenceDiffs =>
	Object.fromEntries(
		COMPARED.map(({ metric, read, lowerIsBetter, preNormalizedErrors }) => {
			const cur = read(current);
			const ref = read(reference);
			const test = zTest(reference.iterations, ref.avg, ref.stdev, current.iterations, cur.avg, cur.stdev, !!preNormalizedErrors);
			const { text, tone } = formatDeltaText(ref.avg, cur.avg, 2, lowerIsBetter, !test.isDiff, true);

			return [metric, { text, tone, significance: formatSignificance(test) }];
		}),
	);
