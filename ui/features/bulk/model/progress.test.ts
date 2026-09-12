import type { BulkSimProgressConfig } from '@sim/bulk/types';
import { BulkSimStage, type ProgressMetrics } from '@generated/proto/api';
import { describe, expect, it } from 'vitest';

import { candidateGearProgress, simProgress } from './progress';

const metrics = (fields: Partial<ProgressMetrics>) =>
	({ completedIterations: 0, totalIterations: 0, completedSims: 0, totalSims: 0, bulkStage: BulkSimStage.BulkSimStageUnknown, ...fields }) as ProgressMetrics;

const config = (fields: Partial<BulkSimProgressConfig> = {}): BulkSimProgressConfig => ({ currentRound: 1, totalRounds: 2, ...fields });

describe('candidateGearProgress', () => {
	it('reports the stage and title alone until it can be measured', () => {
		expect(candidateGearProgress({ now: 1000 })).toEqual({ stage: 'preparing', title: expect.any(String) });
	});

	it('estimates the time left from the rate so far', () => {
		const progress = candidateGearProgress({ completed: 25, total: 100, startedAt: 0, now: 10_000 });
		// 10s for 25 of 100, so 30s for the remaining 75.
		expect(progress.secondsRemaining).toBe(30);
		expect(progress).toMatchObject({ current: 25, total: 100 });
	});

	it('leaves the estimate off before the first candidate lands, so it cannot divide by zero', () => {
		expect(candidateGearProgress({ completed: 0, total: 100, startedAt: 0, now: 10_000 }).secondsRemaining).toBeUndefined();
	});
});

describe('simProgress', () => {
	it('names the reforge stage off the proto rather than off the round', () => {
		const progress = simProgress(metrics({ bulkStage: BulkSimStage.BulkSimStageReforge, totalIterations: 10, completedIterations: 5 }), config(), 0, 1000);
		expect(progress?.stage).toBe('reforging');
	});

	it('reports the aggregate iteration counts when the caller supplies them', () => {
		const progress = simProgress(
			metrics({ totalIterations: 10, completedIterations: 5 }),
			config({ aggregateCompletedIterations: 400, aggregateTotalIterations: 1000, aggregateStartedAt: 0 }),
			0,
			10_000,
		);
		expect(progress?.iterations).toEqual({ completed: 400, total: 1000 });
		expect(progress?.total).toBe(2);
		expect(progress?.current).toBeCloseTo(0.8);
	});

	it('switches to sim counts when the caller asks for them', () => {
		const progress = simProgress(
			metrics({ totalIterations: 100, completedIterations: 50, totalSims: 8, completedSims: 3 }),
			config({ useSimCountProgress: true }),
			0,
			1000,
		);
		expect(progress?.total).toBe(8);
		expect(progress?.current).toBe(4);
	});

	it('returns null on an unusable estimate, so the last frame stays up', () => {
		const unusable = config({ aggregateCompletedIterations: 50, aggregateTotalIterations: 100, aggregateStartedAt: NaN });
		expect(simProgress(metrics({ totalIterations: 100, completedIterations: 50 }), unusable, 0, 1000)).toBeNull();
	});
});
