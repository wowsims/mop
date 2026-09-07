import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SimRuns } from './sim_runs';
import { RequestTypes } from './sim_signal_manager';
import { createSimStore } from './state/sim_store';

let store: ReturnType<typeof createSimStore>;
let abortType: ReturnType<typeof vi.fn>;
let runs: SimRuns;

const state = (kind: Parameters<SimRuns['isRunning']>[0]) => store.getState().runs[kind];

const deferred = <T>() => {
	let settle!: (value: T) => void;
	let fail!: (error: unknown) => void;
	const promise = new Promise<T>((resolve, reject) => {
		settle = resolve;
		fail = reject;
	});
	return { promise, settle, fail };
};

beforeEach(() => {
	store = createSimStore();
	abortType = vi.fn().mockResolvedValue(undefined);
	runs = new SimRuns(store, { abortType: abortType as unknown as (mask: RequestTypes) => Promise<void> });
});

describe('SimRuns', () => {
	it('flags a kind while it runs and clears it on resolve', async () => {
		const run = deferred<string>();
		const started = runs.start('stat-weights', () => run.promise);

		expect(state('stat-weights')).toEqual({ isRunning: true, isAborting: false });
		expect(state('individual-sim').isRunning).toBe(false);

		run.settle('done');
		await expect(started).resolves.toBe('done');
		expect(state('stat-weights')).toEqual({ isRunning: false, isAborting: false });
	});

	it('clears the flag when the run throws, and lets the error through', async () => {
		await expect(runs.start('individual-sim', () => Promise.reject(new Error('worker gone')))).rejects.toThrow('worker gone');
		expect(state('individual-sim')).toEqual({ isRunning: false, isAborting: false });
	});

	// The flag is written before the pre-run abort is awaited, so a rejecting abort has to clear it
	// or the kind stays flagged running with nothing left to clear it.
	it('clears the flag when the pre-run abort rejects', async () => {
		abortType.mockRejectedValueOnce(new Error('worker gone'));
		const run = vi.fn();

		await expect(runs.start('individual-sim', run)).rejects.toThrow('worker gone');
		expect(run).not.toHaveBeenCalled();
		expect(state('individual-sim')).toEqual({ isRunning: false, isAborting: false });
	});

	it('aborts only its own kind, and marks it aborting first', async () => {
		const run = deferred<void>();
		const started = runs.start('reforge-optimize', () => run.promise);

		const aborted = runs.abort('reforge-optimize');
		expect(state('reforge-optimize')).toEqual({ isRunning: true, isAborting: true });
		expect(abortType).toHaveBeenCalledWith(RequestTypes.ReforgeOptimize);

		run.settle();
		await Promise.all([started, aborted]);
		expect(state('reforge-optimize')).toEqual({ isRunning: false, isAborting: false });
	});

	// Marking a kind that is not running would leave `isAborting` set with no run whose
	// teardown could ever clear it.
	it('does nothing when the kind is not running', async () => {
		await runs.abort('bulk-sim');
		expect(abortType).not.toHaveBeenCalled();
		expect(state('bulk-sim')).toEqual({ isRunning: false, isAborting: false });
	});

	it('folds every running kind into one abort mask', async () => {
		const first = deferred<void>();
		const second = deferred<void>();
		const a = runs.start('individual-sim', () => first.promise);
		const b = runs.start('stat-weights', () => second.promise);

		await runs.abort('all');
		expect(abortType).toHaveBeenCalledWith(RequestTypes.IndividualSim | RequestTypes.StatWeights);

		first.settle();
		second.settle();
		await Promise.all([a, b]);
	});

	// The replaced run's teardown lands after the replacement has already flagged itself
	// running, so without the ownership token it would clear the new run's flag.
	it('keeps the flag set when a replaced run settles late', async () => {
		const first = deferred<void>();
		const started = runs.start('individual-sim', () => first.promise);

		const second = deferred<void>();
		const replaced = runs.start('individual-sim', () => second.promise);
		await Promise.resolve();

		first.settle();
		await started;
		expect(state('individual-sim').isRunning).toBe(true);

		second.settle();
		await replaced;
		expect(state('individual-sim').isRunning).toBe(false);
	});

	it('fans progress out to every listener and stops on unsubscribe', async () => {
		const seen: Array<number> = [];
		const other: Array<number> = [];
		const release = runs.onProgress<number>('stat-weights', p => seen.push(p));
		runs.onProgress<number>('stat-weights', p => other.push(p));
		runs.onProgress<number>('individual-sim', p => other.push(p * 100));

		await runs.start<void, number>('stat-weights', async ctx => {
			ctx.emit(1);
			release();
			ctx.emit(2);
		});

		expect(seen).toEqual([1]);
		expect(other).toEqual([1, 2]);
	});

	it('keeps the last progress value after the run ends, and drops it when the next one starts', async () => {
		await runs.start<void, number>('stat-weights', async ctx => ctx.emit(7));
		expect(runs.lastProgress<number>('stat-weights')).toBe(7);

		const run = deferred<void>();
		const started = runs.start('stat-weights', () => run.promise);
		expect(runs.lastProgress<number>('stat-weights')).toBeNull();

		run.settle();
		await started;
	});

	// The flag has to be readable before `start` returns: a vanilla click handler reads the DOM back
	// in its own task, so an injected `flushSync` cannot help a write that happens a microtask later.
	it('flags the kind synchronously, through the injected flush', async () => {
		const flushed: Array<string> = [];
		runs.setFlush(write => {
			flushed.push('flush');
			write();
		});

		const run = deferred<void>();
		const started = runs.start('individual-sim', () => run.promise);
		expect(state('individual-sim').isRunning).toBe(true);
		expect(flushed).toEqual(['flush']);

		run.settle();
		await started;
	});
});
