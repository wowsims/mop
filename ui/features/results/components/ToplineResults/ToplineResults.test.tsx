import { PlayerSpecs } from '@sim/player/specs/index';
import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { SimResultData } from '../../model/result_data';
import { ToplineResults } from './ToplineResults';

let result: SimResultData | null = null;

vi.mock('../../hooks/useSimResult', () => ({ useSimResult: () => result }));

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

describe('ToplineResults', () => {
	it('renders an empty root before the first run', () => {
		const { container } = render(<ToplineResults />);
		const root = container.querySelector('.topline-results-root')!;

		expect(root.className).toBe('topline-results-root results-sim');
		expect(root.children).toHaveLength(0);
	});

	it('renders the one-row table once a result arrives', () => {
		result = resultFor(PlayerSpecs.FireMage);
		const { container } = render(<ToplineResults />);

		expect(container.querySelectorAll('.topline-results-root > table.metrics-table')).toHaveLength(1);
		expect(container.querySelectorAll('.topline-results-root > *')).toHaveLength(1);
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
		const { container } = render(<ToplineResults />);

		expect([...container.querySelectorAll('th')].map(cell => cell.getAttribute('data-metric'))).not.toContain('oom');
	});
});
