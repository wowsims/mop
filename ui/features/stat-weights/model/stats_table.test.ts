import { Stats } from '@domain/proto_utils/stats';
import { StatWeightsResult } from '@generated/proto/api';
import { Stat, UnitStats } from '@generated/proto/common';
import { describe, expect, it, vi } from 'vitest';

import { statsTableColumns, StatsTableSources } from './stats_table';

const marker = (value: number): UnitStats => Stats.fromMap({ [Stat.StatAgility]: value }).toProto();

const MARKERS: Record<string, number> = {
	dpsWeights: 1,
	dpsEp: 2,
	hpsWeights: 3,
	hpsEp: 4,
	tpsWeights: 5,
	tpsEp: 6,
	dtpsWeights: 7,
	dtpsEp: 8,
	tmiWeights: 9,
	tmiEp: 10,
	pDeathWeights: 11,
	pDeathEp: 12,
	defaults: 13,
};

const prevSimResult = (): StatWeightsResult => ({
	dps: { weights: marker(MARKERS.dpsWeights), epValues: marker(MARKERS.dpsEp) },
	hps: { weights: marker(MARKERS.hpsWeights), epValues: marker(MARKERS.hpsEp) },
	tps: { weights: marker(MARKERS.tpsWeights), epValues: marker(MARKERS.tpsEp) },
	dtps: { weights: marker(MARKERS.dtpsWeights), epValues: marker(MARKERS.dtpsEp) },
	tmi: { weights: marker(MARKERS.tmiWeights), epValues: marker(MARKERS.tmiEp) },
	pDeath: { weights: marker(MARKERS.pDeathWeights), epValues: marker(MARKERS.pDeathEp) },
});

const makeSources = (overrides: Partial<StatsTableSources> = {}): StatsTableSources => ({
	getPrevSimResult: () => prevSimResult(),
	getDefaultEpWeights: () => marker(MARKERS.defaults),
	getDpsEpRefStat: () => Stat.StatStrength,
	getHealEpRefStat: () => Stat.StatIntellect,
	getTankEpRefStat: () => Stat.StatArmor,
	...overrides,
});

const columns = () => statsTableColumns(makeSources());
const weightMarker = (weights: UnitStats | undefined) => weights!.stats[Stat.StatAgility];

describe('statsTableColumns', () => {
	it('is 13 columns in metric/type order, ending in the action column', () => {
		expect(columns().map(({ metric, type }) => `${metric ?? 'none'}/${type}`)).toEqual([
			'damage/weight',
			'damage/ep',
			'healing/weight',
			'healing/ep',
			'threat/weight',
			'threat/ep',
			'threat/weight',
			'threat/ep',
			'threat/weight',
			'threat/ep',
			'threat/weight',
			'threat/ep',
			'none/action',
		]);
	});

	it('labels each column with its own translation key', () => {
		expect(columns().map(({ label }) => label)).toEqual([
			'sidebar.buttons.stat_weights.modal.dps_weight.label',
			'sidebar.buttons.stat_weights.modal.dps_ep.label',
			'sidebar.buttons.stat_weights.modal.hps_weight.label',
			'sidebar.buttons.stat_weights.modal.hps_ep.label',
			'sidebar.buttons.stat_weights.modal.tps_weight.label',
			'sidebar.buttons.stat_weights.modal.tps_ep.label',
			'sidebar.buttons.stat_weights.modal.dtps_weight.label',
			'sidebar.buttons.stat_weights.modal.dtps_ep.label',
			'sidebar.buttons.stat_weights.modal.tmi_weight.label',
			'sidebar.buttons.stat_weights.modal.tmi_ep.label',
			'sidebar.buttons.stat_weights.modal.death_weight.label',
			'sidebar.buttons.stat_weights.modal.death_ep.label',
			'sidebar.buttons.stat_weights.modal.current_ep.label',
		]);
	});

	it('gives the twelve metric columns the copy tooltip and the action column the restore one', () => {
		const tooltips = columns().map(({ actionTooltip }) => actionTooltip);

		expect(new Set(tooltips.slice(0, 12))).toEqual(new Set(['sidebar.buttons.stat_weights.modal.tooltips.copy_to_current_ep']));
		expect(tooltips[12]).toBe('sidebar.buttons.stat_weights.modal.tooltips.restore_default_ep');
	});

	it('binds each column to its own block and field of the previous result', () => {
		expect(columns().map(({ getWeights }) => weightMarker(getWeights()))).toEqual([
			MARKERS.dpsWeights,
			MARKERS.dpsEp,
			MARKERS.hpsWeights,
			MARKERS.hpsEp,
			MARKERS.tpsWeights,
			MARKERS.tpsEp,
			MARKERS.dtpsWeights,
			MARKERS.dtpsEp,
			MARKERS.tmiWeights,
			MARKERS.tmiEp,
			MARKERS.pDeathWeights,
			MARKERS.pDeathEp,
			MARKERS.defaults,
		]);
	});

	it('carries a ref stat on the six ep columns only', () => {
		expect(columns().map(({ getEpRefStat }) => !!getEpRefStat)).toEqual([
			false,
			true,
			false,
			true,
			false,
			true,
			false,
			true,
			false,
			true,
			false,
			true,
			false,
		]);
	});

	it('normalises tps by the dps ref stat and dtps, tmi and pDeath by the tank one', () => {
		expect(columns().map(({ getEpRefStat }) => getEpRefStat?.())).toEqual([
			undefined,
			Stat.StatStrength,
			undefined,
			Stat.StatIntellect,
			undefined,
			Stat.StatStrength,
			undefined,
			Stat.StatArmor,
			undefined,
			Stat.StatArmor,
			undefined,
			Stat.StatArmor,
			undefined,
		]);
	});

	it('reads nothing from the sources while it is being built', () => {
		const getPrevSimResult = vi.fn(prevSimResult);
		const getDpsEpRefStat = vi.fn(() => Stat.StatStrength);
		statsTableColumns(makeSources({ getPrevSimResult, getDpsEpRefStat }));

		expect(getPrevSimResult).not.toHaveBeenCalled();
		expect(getDpsEpRefStat).not.toHaveBeenCalled();
	});

	it('re-reads the ref stat on every call, so a changed selection is followed', () => {
		let refStat = Stat.StatStrength;
		const [, dpsEp] = statsTableColumns(makeSources({ getDpsEpRefStat: () => refStat }));

		expect(dpsEp.getEpRefStat!()).toBe(Stat.StatStrength);
		refStat = Stat.StatSpirit;
		expect(dpsEp.getEpRefStat!()).toBe(Stat.StatSpirit);
	});

	it('re-reads the previous result on every call', () => {
		let value = 1;
		const [dpsWeight] = statsTableColumns(makeSources({ getPrevSimResult: () => ({ dps: { weights: marker(value) } }) }));

		expect(weightMarker(dpsWeight.getWeights())).toBe(1);
		value = 2;
		expect(weightMarker(dpsWeight.getWeights())).toBe(2);
	});
});
