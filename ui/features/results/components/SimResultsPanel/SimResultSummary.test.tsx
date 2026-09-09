import { SimHostProvider } from '@sim/context/SimHostContext';
import { PlayerSpecs } from '@sim/player/specs/index';
import type { IndividualSimHost } from '@sim/sim_host';
import { Raid as RaidProto } from '@generated/proto/api';
import { Encounter as EncounterProto } from '@generated/proto/common';
import { act, fireEvent, render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SimResultsManager } from '../../model/results_manager';
import { SimResultSummary } from './SimResultSummary';

const host = { config: { cssScheme: 'mage' } } as unknown as IndividualSimHost<any>;

const dist = (avg: number, stdev = 0) => ({ avg, stdev });

// Both accessor sets the reference bar reads: the raid's for dps and hps, the first player's for the
// other five.
const result = (dps: number, iterations = 1000) =>
	({
		iterations,
		raidMetrics: { dps: dist(dps, 10), hps: dist(20, 2) },
		getFirstPlayer: () => player,
		getRaidIndexedPlayers: () => [player],
		getRaidIndexedActionMetrics: () => [],
		getTargets: () => [],
		request: { raid: RaidProto.create(), encounter: EncounterProto.create() },
		result: { avgIterationDuration: 300 },
		encounterMetrics: { durationSeconds: 300 },
		toProto: () => ({}),
	}) as never;

const player = {
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
};

const sim = () =>
	({
		raid: { toProto: () => RaidProto.create(), fromProto: vi.fn() },
		encounter: { toProto: () => EncounterProto.create(), fromProto: vi.fn() },
	}) as never;

const mount = (results: SimResultsManager) =>
	render(
		<SimHostProvider host={host}>
			<SimResultSummary results={results} />
		</SimHostProvider>,
	);

const diffs = (container: HTMLElement) => [...container.querySelectorAll('.results-reference:not(.hide) > .results-reference-diff')];

let results: SimResultsManager;

describe('SimResultSummary', () => {
	beforeEach(() => {
		results = new SimResultsManager(sim());
	});

	it('renders nothing before the first run', () => {
		expect(mount(results).container.innerHTML).toBe('');
	});

	it('renders the stacked metric list and the reference bar once a run lands', () => {
		act(() => results.setSimResult(result(1000)));
		const { container } = mount(results);

		expect([...container.querySelectorAll('.results-metric')].map(row => row.getAttribute('data-metric'))).toEqual([
			'dps',
			'tps',
			'dtps',
			'tmi',
			'cod',
			'tto',
			'hps',
		]);
		expect(container.querySelector('.results-sim-reference')?.className).toBe('results-sim-reference');
		expect([...container.querySelectorAll('.results-sim-reference button')].map(button => button.getAttribute('type'))).toEqual([
			'button',
			'button',
			'button',
		]);
	});

	it('keeps every reference slot hidden and empty until a reference is saved', () => {
		act(() => results.setSimResult(result(1000)));
		const { container } = mount(results);

		expect(diffs(container)).toEqual([]);
		expect(container.querySelectorAll('.results-reference.hide > .results-reference-diff')).toHaveLength(7);
	});

	it('fills the deltas in and flags the bar the moment the reference is set', () => {
		act(() => results.setSimResult(result(1000)));
		const { container } = mount(results);

		act(() => fireEvent.click(container.querySelector('.results-sim-set-reference')!));
		expect(container.querySelector('.results-sim-reference')?.className).toBe('results-sim-reference has-reference');

		// Same run on both sides: every rendered metric gets a delta, all of them zero and none coloured.
		expect(diffs(container)).toHaveLength(7);
		expect(new Set(diffs(container).map(diff => diff.textContent))).toEqual(new Set(['+0.00 (0.00%)']));
		expect(new Set(diffs(container).map(diff => diff.className))).toEqual(new Set(['results-reference-diff']));
	});

	it('colours a significant gain positive and carries the z score on the anchor', () => {
		act(() => results.setSimResult(result(1000)));
		const { container } = mount(results);
		act(() => fireEvent.click(container.querySelector('.results-sim-set-reference')!));
		act(() => results.setSimResult(result(1100)));

		const dps = container.querySelector('.results-sim-dps .results-reference-diff')!;
		expect(dps.textContent).toBe('+100.00 (10.00%)');
		expect(dps.className).toBe('results-reference-diff positive');
		expect(dps.getAttribute('data-tooltip-content')).toMatch(/^Difference is significantly different \(Z = \d+\.\d{3}\)\.$/);
	});

	it('drops the reference again on delete', () => {
		act(() => results.setSimResult(result(1000)));
		const { container } = mount(results);
		act(() => fireEvent.click(container.querySelector('.results-sim-set-reference')!));
		act(() => fireEvent.click(container.querySelector('.results-sim-reference-delete')!));

		expect(container.querySelector('.results-sim-reference')?.className).toBe('results-sim-reference');
		expect(diffs(container)).toEqual([]);
	});

	it('swaps the two runs, so the delta changes sign', () => {
		act(() => results.setSimResult(result(1000)));
		const { container } = mount(results);
		act(() => fireEvent.click(container.querySelector('.results-sim-set-reference')!));
		act(() => results.setSimResult(result(1100)));

		act(() => fireEvent.click(container.querySelector('.results-sim-reference-swap')!));

		const dps = container.querySelector('.results-sim-dps .results-reference-diff')!;
		expect(dps.textContent).toBe('-100.00 (10.00%)');
		expect(dps.className).toBe('results-reference-diff negative');
	});
});
