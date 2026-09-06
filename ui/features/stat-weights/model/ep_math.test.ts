import { Stats, UnitStat } from '@domain/proto_utils/stats';
import { StatWeightsResult, StatWeightValues } from '@generated/proto/api';
import { PseudoStat, Stat } from '@generated/proto/common';
import { describe, expect, it } from 'vitest';

import { calculateEp, combineScaledEpValues, combineScaledWeights, emptyStatWeightsResult, epWeightsWithoutExcluded } from './ep_math';

const AGILITY = UnitStat.fromStat(Stat.StatAgility);
const MAIN_HAND_DPS = UnitStat.fromPseudoStat(PseudoStat.PseudoStatMainHandDps);

const values = (weights: Partial<Record<Stat, number>>, weightsStdev: Partial<Record<Stat, number>> = {}): StatWeightValues => ({
	weights: Stats.fromMap(weights).toProto(),
	weightsStdev: Stats.fromMap(weightsStdev).toProto(),
	epValues: new Stats().toProto(),
	epValuesStdev: new Stats().toProto(),
});

const result = (overrides: Partial<StatWeightsResult> = {}): StatWeightsResult => ({
	dps: values({}),
	hps: values({}),
	tps: values({}),
	dtps: values({}),
	tmi: values({}),
	pDeath: values({}),
	...overrides,
});

const epOf = (block: StatWeightValues | undefined, stat: UnitStat) => stat.getProtoValue(block!.epValues!);
const epStdevOf = (block: StatWeightValues | undefined, stat: UnitStat) => stat.getProtoValue(block!.epValuesStdev!);

const noRefs = { dps: undefined, heal: undefined, tank: undefined };

describe('calculateEp', () => {
	it('normalises dps and tps against the dps ref stat', () => {
		const calculated = calculateEp(
			result({
				dps: values({ [Stat.StatStrength]: 4, [Stat.StatAgility]: 2 }),
				tps: values({ [Stat.StatStrength]: 5, [Stat.StatAgility]: 10 }),
			}),
			{ ...noRefs, dps: Stat.StatStrength },
		);

		expect(epOf(calculated.dps, AGILITY)).toBe(0.5);
		expect(epOf(calculated.tps, AGILITY)).toBe(2);
	});

	it('normalises hps against the heal ref stat and nothing else', () => {
		const calculated = calculateEp(
			result({
				hps: values({ [Stat.StatStrength]: 4, [Stat.StatAgility]: 2 }),
				dps: values({ [Stat.StatStrength]: 4, [Stat.StatAgility]: 2 }),
			}),
			{ ...noRefs, heal: Stat.StatStrength },
		);

		expect(epOf(calculated.hps, AGILITY)).toBe(0.5);
		expect(epOf(calculated.dps, AGILITY)).toBe(0);
	});

	it('normalises dtps, tmi and pDeath against the tank ref stat', () => {
		const block = () => values({ [Stat.StatStrength]: 4, [Stat.StatAgility]: 2 });
		const calculated = calculateEp(result({ dtps: block(), tmi: block(), pDeath: block() }), { ...noRefs, tank: Stat.StatStrength });

		expect([epOf(calculated.dtps, AGILITY), epOf(calculated.tmi, AGILITY), epOf(calculated.pDeath, AGILITY)]).toEqual([0.5, 0.5, 0.5]);
	});

	it('writes zero rather than dividing when the ref weight is zero', () => {
		const calculated = calculateEp(result({ dps: values({ [Stat.StatStrength]: 0, [Stat.StatAgility]: 2 }) }), { ...noRefs, dps: Stat.StatStrength });

		expect(epOf(calculated.dps, AGILITY)).toBe(0);
	});

	it('writes zero rather than dividing when the ref stdev is zero', () => {
		const calculated = calculateEp(
			result({ dps: values({ [Stat.StatStrength]: 4, [Stat.StatAgility]: 2 }, { [Stat.StatStrength]: 0, [Stat.StatAgility]: 3 }) }),
			{ ...noRefs, dps: Stat.StatStrength },
		);

		expect(epStdevOf(calculated.dps, AGILITY)).toBe(0);
	});

	it('normalises the stdev against the stdev ref, not the weight ref', () => {
		const calculated = calculateEp(
			result({ dps: values({ [Stat.StatStrength]: 4, [Stat.StatAgility]: 2 }, { [Stat.StatStrength]: 2, [Stat.StatAgility]: 3 }) }),
			{ ...noRefs, dps: Stat.StatStrength },
		);

		expect(epStdevOf(calculated.dps, AGILITY)).toBe(1.5);
	});

	it('normalises the seven listed pseudo-stats too', () => {
		const calculated = calculateEp(
			result({
				dps: {
					weights: Stats.fromMap({ [Stat.StatStrength]: 4 }, { [PseudoStat.PseudoStatMainHandDps]: 6 }).toProto(),
					weightsStdev: new Stats().toProto(),
					epValues: new Stats().toProto(),
					epValuesStdev: new Stats().toProto(),
				},
			}),
			{ ...noRefs, dps: Stat.StatStrength },
		);

		expect(epOf(calculated.dps, MAIN_HAND_DPS)).toBe(1.5);
	});

	it('leaves the input untouched', () => {
		const input = result({ dps: values({ [Stat.StatStrength]: 4, [Stat.StatAgility]: 2 }) });
		calculateEp(input, { ...noRefs, dps: Stat.StatStrength });

		expect(epOf(input.dps, AGILITY)).toBe(0);
	});

	it('writes no ep value at all when every ref stat is undefined', () => {
		const calculated = calculateEp(result({ dps: values({ [Stat.StatStrength]: 4, [Stat.StatAgility]: 2 }) }), noRefs);

		expect(epOf(calculated.dps, AGILITY)).toBe(0);
	});
});

describe('emptyStatWeightsResult', () => {
	it('carries all six zeroed blocks', () => {
		const empty = emptyStatWeightsResult();
		const blocks = [empty.dps, empty.hps, empty.tps, empty.dtps, empty.tmi, empty.pDeath];

		expect(blocks.every(block => !!block?.weights && !!block.weightsStdev && !!block.epValues && !!block.epValuesStdev)).toBe(true);
		expect(blocks.map(block => epOf(block, AGILITY))).toEqual([0, 0, 0, 0, 0, 0]);
	});

	it('gives each block its own arrays, so normalising one does not reach the others', () => {
		const empty = emptyStatWeightsResult();
		AGILITY.setProtoValue(empty.dps!.epValues!, 7);

		expect(epOf(empty.hps, AGILITY)).toBe(0);
		expect(epOf(emptyStatWeightsResult().dps, AGILITY)).toBe(0);
	});
});

describe('combineScaledEpValues', () => {
	const withEpValues = (perBlock: number[]): StatWeightsResult => {
		const block = (value: number): StatWeightValues => ({
			weights: new Stats().toProto(),
			weightsStdev: new Stats().toProto(),
			epValues: Stats.fromMap({ [Stat.StatAgility]: value }).toProto(),
			epValuesStdev: new Stats().toProto(),
		});
		const [dps, hps, tps, dtps, tmi, pDeath] = perBlock.map(block);
		return { dps, hps, tps, dtps, tmi, pDeath };
	};

	it('applies the ratios in dps, hps, tps, dtps, tmi, pDeath order', () => {
		const combined = combineScaledEpValues(withEpValues([1, 2, 3, 4, 5, 6]), [1, 10, 100, 1000, 10000, 100000]);

		expect(combined.getStat(Stat.StatAgility)).toBe(1 + 20 + 300 + 4000 + 50000 + 600000);
	});

	it('drops a block whose ratio is zero', () => {
		const combined = combineScaledEpValues(withEpValues([1, 2, 3, 4, 5, 6]), [0, 1, 0, 0, 0, 0]);

		expect(combined.getStat(Stat.StatAgility)).toBe(2);
	});

	it('reads epValues, not weights', () => {
		const results = withEpValues([1, 0, 0, 0, 0, 0]);
		results.dps!.weights = Stats.fromMap({ [Stat.StatAgility]: 99 }).toProto();

		expect(combineScaledEpValues(results, [1, 1, 1, 1, 1, 1]).getStat(Stat.StatAgility)).toBe(1);
	});
});

describe('combineScaledWeights', () => {
	it('reads weights, not epValues', () => {
		const block = (weight: number, epValue: number): StatWeightValues => ({
			weights: Stats.fromMap({ [Stat.StatAgility]: weight }).toProto(),
			weightsStdev: new Stats().toProto(),
			epValues: Stats.fromMap({ [Stat.StatAgility]: epValue }).toProto(),
			epValuesStdev: new Stats().toProto(),
		});
		const results: StatWeightsResult = {
			dps: block(3, 99),
			hps: block(0, 99),
			tps: block(0, 99),
			dtps: block(0, 99),
			tmi: block(0, 99),
			pDeath: block(0, 99),
		};

		expect(combineScaledWeights(results, [2, 1, 1, 1, 1, 1]).getStat(Stat.StatAgility)).toBe(6);
	});
});

describe('epWeightsWithoutExcluded', () => {
	const newWeights = Stats.fromMap({ [Stat.StatStrength]: 10, [Stat.StatAgility]: 20 }, { [PseudoStat.PseudoStatMainHandDps]: 30 });
	const oldWeights = Stats.fromMap({ [Stat.StatStrength]: 1, [Stat.StatAgility]: 2 }, { [PseudoStat.PseudoStatMainHandDps]: 3 });

	it('takes the new value for a stat that is not excluded', () => {
		const merged = epWeightsWithoutExcluded(newWeights, oldWeights, { excludedStats: [], excludedPseudoStats: [] });

		expect(merged.getStat(Stat.StatStrength)).toBe(10);
		expect(merged.getPseudoStat(PseudoStat.PseudoStatMainHandDps)).toBe(30);
	});

	it('keeps the old value for an excluded stat and only that stat', () => {
		const merged = epWeightsWithoutExcluded(newWeights, oldWeights, { excludedStats: [Stat.StatStrength], excludedPseudoStats: [] });

		expect(merged.getStat(Stat.StatStrength)).toBe(1);
		expect(merged.getStat(Stat.StatAgility)).toBe(20);
	});

	it('keeps the old value for an excluded pseudo-stat and only that pseudo-stat', () => {
		const merged = epWeightsWithoutExcluded(newWeights, oldWeights, { excludedStats: [], excludedPseudoStats: [PseudoStat.PseudoStatMainHandDps] });

		expect(merged.getPseudoStat(PseudoStat.PseudoStatMainHandDps)).toBe(3);
		expect(merged.getStat(Stat.StatStrength)).toBe(10);
	});
});
