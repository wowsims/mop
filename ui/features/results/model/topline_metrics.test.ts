import { PlayerSpecs } from '@sim/player/specs/index';
import { describe, expect, it, vi } from 'vitest';

import { showsOutOfMana, toplineResultMetrics } from './topline_metrics';

vi.mock('@sim/proto/sim_result', async importOriginal => {
	const actual = await importOriginal<typeof import('@sim/proto/sim_result')>();
	const sum = (actions: Array<{ dps: number; tps: number }>, key: 'dps' | 'tps') => actions.reduce((total, action) => total + action[key], 0);
	return {
		...actual,
		ActionMetrics: {
			merge: (actions: Array<{ dps: number; tps: number }>) => ({ dps: sum(actions, 'dps'), tps: sum(actions, 'tps') }),
		},
	};
});

const dist = (avg: number, stdev = 0) => ({ avg, stdev });

const player = (overrides: Record<string, unknown> = {}) => ({
	spec: PlayerSpecs.FireMage,
	unitIndex: 0,
	getTargetIndex: () => null,
	dps: dist(1000, 10),
	tps: dist(500, 5),
	dtps: dist(50, 1),
	tmi: dist(2, 0.5),
	hps: dist(20, 2),
	tto: dist(30, 3),
	chanceOfDeath: dist(1, 0.1),
	secondsOomAvg: 0,
	...overrides,
});

const simResult = (players: Array<ReturnType<typeof player>>, overrides: Record<string, unknown> = {}) =>
	({
		getRaidIndexedPlayers: () => players,
		getRaidIndexedActionMetrics: () => [],
		getTargets: () => [],
		request: { encounter: { useHealth: false } },
		result: { avgIterationDuration: 300 },
		encounterMetrics: { durationSeconds: 300 },
		...overrides,
	}) as never;

const keys = (result: never, options?: { showOutOfMana?: boolean }) => toplineResultMetrics(result, undefined, options).map(metric => metric.metric);

describe('toplineResultMetrics', () => {
	it('lists the whole-encounter metrics for a non-tank, with tto and hps last', () => {
		expect(keys(simResult([player()]))).toEqual(['dps', 'tps', 'dtps', 'tmi', 'cod', 'tto', 'hps']);
	});

	it('moves hps into the block and drops tto for a tank spec', () => {
		expect(keys(simResult([player({ spec: PlayerSpecs.ProtectionWarrior })]))).toEqual(['dps', 'tps', 'dtps', 'hps', 'tmi', 'cod']);
	});

	it('carries the metric class and its category class', () => {
		const metrics = toplineResultMetrics(simResult([player()]));

		expect(metrics[0]).toMatchObject({
			metric: 'dps',
			name: 'sidebar.results.metrics.dps.label',
			average: 1000,
			stdev: 10,
			classes: 'results-sim-dps damage-metrics',
		});
		expect(metrics.find(metric => metric.metric === 'tmi')).toMatchObject({ classes: 'results-sim-tmi threat-metrics', unit: 'percentage' });
	});

	it('merges the filtered actions when a target is selected', () => {
		const result = simResult([player({ getTargetIndex: () => 0 })], {
			getRaidIndexedActionMetrics: () => [{ dps: 400, tps: 200 }],
			getTargets: () => [{ actions: [{ forTarget: () => ({ dps: 30, tps: 0 }) }] }],
		});

		expect(keys(result)).toEqual(['dps', 'tps', 'dtps', 'tto', 'hps']);
		expect(toplineResultMetrics(result)[0]).toMatchObject({ metric: 'dps', average: 400, stdev: undefined });
	});

	it('omits the merged columns a filtered encounter has no actions for', () => {
		expect(keys(simResult([player({ getTargetIndex: () => 0 })]))).toEqual(['tto', 'hps']);
	});

	it('appends dur only when the encounter uses health', () => {
		const result = simResult([player()], { request: { encounter: { useHealth: true } } });

		expect(keys(result).at(-1)).toBe('dur');
		expect(toplineResultMetrics(result).at(-1)).toMatchObject({ metric: 'dur', average: 300, unit: 'seconds' });
	});

	it.each([
		[1, 'safe'],
		[10, 'warning'],
		[100, 'danger'],
	])('grades %d seconds out of mana as %s', (secondsOomAvg, danger) => {
		const metrics = toplineResultMetrics(simResult([player({ secondsOomAvg })]), undefined, { showOutOfMana: true });

		expect(metrics.at(-1)).toMatchObject({ metric: 'oom', classes: `results-sim-oom ${danger}`, unit: 'seconds' });
	});

	it('leaves out-of-mana out unless it is asked for', () => {
		expect(keys(simResult([player({ secondsOomAvg: 100 })]))).not.toContain('oom');
	});
});

describe('showsOutOfMana', () => {
	it('is on for a lone mana user', () => {
		expect(showsOutOfMana(simResult([player()]))).toBe(true);
	});

	it('is off for a class with no mana bar', () => {
		expect(showsOutOfMana(simResult([player({ spec: PlayerSpecs.ArmsWarrior })]))).toBe(false);
	});

	it('is off for a raid', () => {
		expect(showsOutOfMana(simResult([player(), player()]))).toBe(false);
	});

	it('is off for a player with no spec', () => {
		expect(showsOutOfMana(simResult([player({ spec: null })]))).toBe(false);
	});
});
