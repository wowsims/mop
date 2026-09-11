import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SimRuns } from './sim_runs';
import { RequestTypes } from './sim_signal_manager';
import { createSimStore } from './state/sim_store';
import { SimRunKind } from './state/sim_store';

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
		const started = runs.start(SimRunKind.StatWeights, () => run.promise);

		expect(state(SimRunKind.StatWeights)).toEqual({ isRunning: true, isAborting: false });
		expect(state(SimRunKind.IndividualSim).isRunning).toBe(false);

		run.settle('done');
		await expect(started).resolves.toBe('done');
		expect(state(SimRunKind.StatWeights)).toEqual({ isRunning: false, isAborting: false });
	});

	it('clears the flag when the run throws, and lets the error through', async () => {
		await expect(runs.start(SimRunKind.IndividualSim, () => Promise.reject(new Error('worker gone')))).rejects.toThrow('worker gone');
		expect(state(SimRunKind.IndividualSim)).toEqual({ isRunning: false, isAborting: false });
	});

	// The flag is written before the pre-run abort is awaited, so a rejecting abort has to clear it
	// or the kind stays flagged running with nothing left to clear it.
	it('clears the flag when the pre-run abort rejects', async () => {
		abortType.mockRejectedValueOnce(new Error('worker gone'));
		const run = vi.fn();

		await expect(runs.start(SimRunKind.IndividualSim, run)).rejects.toThrow('worker gone');
		expect(run).not.toHaveBeenCalled();
		expect(state(SimRunKind.IndividualSim)).toEqual({ isRunning: false, isAborting: false });
	});

	it('aborts only its own kind, and marks it aborting first', async () => {
		const run = deferred<void>();
		const started = runs.start(SimRunKind.ReforgeOptimize, () => run.promise);

		const aborted = runs.abort(SimRunKind.ReforgeOptimize);
		expect(state(SimRunKind.ReforgeOptimize)).toEqual({ isRunning: true, isAborting: true });
		expect(abortType).toHaveBeenCalledWith(RequestTypes.ReforgeOptimize);

		run.settle();
		await Promise.all([started, aborted]);
		expect(state(SimRunKind.ReforgeOptimize)).toEqual({ isRunning: false, isAborting: false });
	});

	// Marking a kind that is not running would leave `isAborting` set with no run whose
	// teardown could ever clear it.
	it('does nothing when the kind is not running', async () => {
		await runs.abort(SimRunKind.BulkSim);
		expect(abortType).not.toHaveBeenCalled();
		expect(state(SimRunKind.BulkSim)).toEqual({ isRunning: false, isAborting: false });
	});

	it('folds every running kind into one abort mask', async () => {
		const first = deferred<void>();
		const second = deferred<void>();
		const a = runs.start(SimRunKind.IndividualSim, () => first.promise);
		const b = runs.start(SimRunKind.StatWeights, () => second.promise);

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
		const started = runs.start(SimRunKind.IndividualSim, () => first.promise);

		const second = deferred<void>();
		const replaced = runs.start(SimRunKind.IndividualSim, () => second.promise);
		await Promise.resolve();

		first.settle();
		await started;
		expect(state(SimRunKind.IndividualSim).isRunning).toBe(true);

		second.settle();
		await replaced;
		expect(state(SimRunKind.IndividualSim).isRunning).toBe(false);
	});

	it('fans progress out to every listener and stops on unsubscribe', async () => {
		const seen: Array<number> = [];
		const other: Array<number> = [];
		const release = runs.onProgress<number>(SimRunKind.StatWeights, p => seen.push(p));
		runs.onProgress<number>(SimRunKind.StatWeights, p => other.push(p));
		runs.onProgress<number>(SimRunKind.IndividualSim, p => other.push(p * 100));

		await runs.start<void, number>(SimRunKind.StatWeights, async ctx => {
			ctx.emit(1);
			release();
			ctx.emit(2);
		});

		expect(seen).toEqual([1]);
		expect(other).toEqual([1, 2]);
	});

	it('keeps the last progress value after the run ends, and drops it when the next one starts', async () => {
		await runs.start<void, number>(SimRunKind.StatWeights, async ctx => ctx.emit(7));
		expect(runs.lastProgress<number>(SimRunKind.StatWeights)).toBe(7);

		const run = deferred<void>();
		const started = runs.start(SimRunKind.StatWeights, () => run.promise);
		expect(runs.lastProgress<number>(SimRunKind.StatWeights)).toBeNull();

		run.settle();
		await started;
	});

	// The flag has to be readable before `start` returns, because an injected `flushSync` cannot
	// help a write that happens a microtask later.
	it('flags the kind synchronously, through the injected flush', async () => {
		const flushed: Array<string> = [];
		runs.setFlush(write => {
			flushed.push('flush');
			write();
		});

		const run = deferred<void>();
		const started = runs.start(SimRunKind.IndividualSim, () => run.promise);
		expect(state(SimRunKind.IndividualSim).isRunning).toBe(true);
		expect(flushed).toEqual(['flush']);

		run.settle();
		await started;
	});
});
