import { Stats, UnitStat } from '@domain/proto_utils/stats';
import { StatWeightsResult, StatWeightValues } from '@generated/proto/api';
import { PseudoStat, Stat, UnitStats } from '@generated/proto/common';

import { EP_UNIT_STATS } from './ep_unit_stats';

export type EpRefStats = {
	dps: Stat | undefined;
	heal: Stat | undefined;
	tank: Stat | undefined;
};

export type ExcludedStats = {
	excludedStats: Stat[];
	excludedPseudoStats: PseudoStat[];
};

const normaliseEpValue = (refStat: Stat, values: StatWeightValues) => {
	const refUnitStat = UnitStat.fromStat(refStat);
	const refWeight = refUnitStat.getProtoValue(values.weights!);
	const refStdev = refUnitStat.getProtoValue(values.weightsStdev!);
	EP_UNIT_STATS.forEach(stat => {
		const value = stat.getProtoValue(values.weights!);
		stat.setProtoValue(values.epValues!, refWeight === 0 ? 0 : value / refWeight);

		const valueStdev = stat.getProtoValue(values.weightsStdev!);
		stat.setProtoValue(values.epValuesStdev!, refStdev === 0 ? 0 : valueStdev / refStdev);
	});
};

export const calculateEp = (weights: StatWeightsResult, refStats: EpRefStats): StatWeightsResult => {
	const result = StatWeightsResult.clone(weights);

	if (refStats.dps !== undefined) {
		normaliseEpValue(refStats.dps, result.dps!);
		normaliseEpValue(refStats.dps, result.tps!);
	}
	if (refStats.heal !== undefined) {
		normaliseEpValue(refStats.heal, result.hps!);
	}
	if (refStats.tank !== undefined) {
		normaliseEpValue(refStats.tank, result.dtps!);
		normaliseEpValue(refStats.tank, result.tmi!);
		normaliseEpValue(refStats.tank, result.pDeath!);
	}
	return result;
};

const emptyStatWeightValues = () => ({
	weights: new Stats().toProto(),
	weightsStdev: new Stats().toProto(),
	epValues: new Stats().toProto(),
	epValuesStdev: new Stats().toProto(),
});

export const emptyStatWeightsResult = (): StatWeightsResult =>
	StatWeightsResult.create({
		dps: emptyStatWeightValues(),
		hps: emptyStatWeightValues(),
		tps: emptyStatWeightValues(),
		dtps: emptyStatWeightValues(),
		tmi: emptyStatWeightValues(),
		pDeath: emptyStatWeightValues(),
	});

const combineScaled = (results: StatWeightsResult, epRatios: number[], select: (values: StatWeightValues) => UnitStats | undefined): Stats =>
	[results.dps!, results.hps!, results.tps!, results.dtps!, results.tmi!, results.pDeath!]
		.map((values, index) => Stats.fromProto(select(values)).scale(epRatios[index]))
		.reduce((total, scaled) => total.add(scaled));

export const combineScaledEpValues = (results: StatWeightsResult, epRatios: number[]): Stats => combineScaled(results, epRatios, values => values.epValues);

export const combineScaledWeights = (results: StatWeightsResult, epRatios: number[]): Stats => combineScaled(results, epRatios, values => values.weights);

export const epWeightsWithoutExcluded = (newWeights: Stats, oldWeights: Stats, { excludedStats, excludedPseudoStats }: ExcludedStats): Stats => {
	let merged = newWeights;
	for (const stat of excludedStats) {
		merged = merged.withStat(stat, oldWeights.getStat(stat));
	}
	for (const pseudoStat of excludedPseudoStats) {
		merged = merged.withPseudoStat(pseudoStat, oldWeights.getPseudoStat(pseudoStat));
	}
	return merged;
};
