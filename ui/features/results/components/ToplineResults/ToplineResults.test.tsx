import { SimHostProvider } from '@sim/context/SimHostContext';
import { PlayerSpecs } from '@sim/player/specs/index';
import { fakeHost, mockSubscriptions } from '@sim/testing';
import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { SimResultData } from '../../model/result_data';
import { ToplineResults } from './ToplineResults';

vi.mock('@sim/state/subscriptions', async () => mockSubscriptions());

let result: SimResultData | null = null;

vi.mock('../../hooks/useSimResult', () => ({ useSimResult: () => result }));

const host = fakeHost({
	sim: { getShowDamageMetrics: () => true, getShowThreatMetrics: () => true, getShowHealingMetrics: () => true } as never,
});

const dist = (avg: number, stdev = 0) => ({ avg, stdev });

const resultFor = (spec: unknown) =>
	({
		result: {
			getRaidIndexedPlayers: () => [
				{
					spec,
					unitIndex: 0,
					getTargetIndex: () => null,
					dps: dist(1000, 10),
					tps: dist(500),
					dtps: dist(50),
					tmi: dist(2),
					hps: dist(20),
					tto: dist(30),
					chanceOfDeath: dist(1),
					secondsOomAvg: 4,
				},
			],
			getRaidIndexedActionMetrics: () => [],
			getTargets: () => [],
			request: { encounter: { useHealth: false } },
			result: { avgIterationDuration: 300 },
			encounterMetrics: { durationSeconds: 300 },
		},
		filter: {},
	}) as never;

beforeEach(() => {
	result = null;
});

const mount = () => render(<SimHostProvider host={host}>{<ToplineResults />}</SimHostProvider>);

describe('ToplineResults', () => {
	it('renders an empty root before the first run', () => {
		const { container } = mount();
		const root = container.querySelector('[data-testid="topline-results-root"]')!;

		expect(root).toBeTruthy();
		expect(root.children).toHaveLength(0);
	});

	it('renders the one-row table once a result arrives', () => {
		result = resultFor(PlayerSpecs.FireMage);
		const { container } = mount();

		expect(container.querySelectorAll('[data-testid="topline-results-root"] > table[data-testid="metrics-table"]')).toHaveLength(1);
		expect(container.querySelectorAll('[data-testid="topline-results-root"] > *')).toHaveLength(1);
		expect([...container.querySelectorAll('th')].map(cell => cell.getAttribute('data-metric'))).toEqual([
			'dps',
			'tps',
			'dtps',
			'tmi',
			'cod',
			'tto',
			'hps',
			'oom',
		]);
	});

	it('drops the out-of-mana column for a class with no mana bar', () => {
		result = resultFor(PlayerSpecs.ArmsWarrior);
		const { container } = mount();

		expect([...container.querySelectorAll('th')].map(cell => cell.getAttribute('data-metric'))).not.toContain('oom');
	});
});
