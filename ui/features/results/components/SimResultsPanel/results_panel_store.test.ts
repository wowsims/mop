import { ProgressMetrics } from '@generated/proto/api';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ResultsPanelStage, ResultsPanelStore } from './results_panel_store';

const tick = (completed: number) => ProgressMetrics.create({ dps: completed, hps: 0, completedIterations: completed, totalIterations: 100 });

let store: ResultsPanelStore;

describe('ResultsPanelStore', () => {
	beforeEach(() => {
		store = new ResultsPanelStore();
	});

	it('starts idle with the buttons down', () => {
		expect(store.getStage()).toBe(ResultsPanelStage.Idle);
		expect(store.getButtonsVisible()).toBe(false);
		expect(store.getAbortHandler()).toBeNull();
	});

	it('notifies on a stage change and on the button zone, but never on a progress tick', () => {
		const listener = vi.fn();
		store.subscribe(listener);

		store.setPending();
		store.setProgress(tick(1));
		const afterFirstTick = listener.mock.calls.length;
		store.setProgress(tick(2));
		store.setProgress(tick(3));

		expect(afterFirstTick).toBe(2);
		expect(listener.mock.calls.length).toBe(afterFirstTick);

		store.addAbortButton(() => {});
		store.removeAbortButton();
		expect(listener.mock.calls.length).toBe(afterFirstTick + 2);
	});

	it('holds the latest tick outside the snapshot, and forgets it when a new run starts', () => {
		store.setPending();
		store.setProgress(tick(1));
		store.setProgress(tick(7));
		expect(store.latestProgress?.completedIterations).toBe(7);

		// Otherwise the next run's block would mount showing the previous run's numbers.
		store.setPending();
		expect(store.latestProgress).toBeNull();
	});

	it('sends ticks to the listener only once one is registered, and stops on unsubscribe', () => {
		const written: Array<number> = [];
		store.setPending();
		// The tick that moves the stage lands before any listener exists; the mounting component reads
		// `latestProgress` for it instead.
		store.setProgress(tick(1));
		expect(written).toEqual([]);

		const unsubscribe = store.onProgress(progress => written.push(progress.completedIterations));
		store.setProgress(tick(2));
		unsubscribe();
		store.setProgress(tick(3));

		expect(written).toEqual([2]);
		expect(store.latestProgress?.completedIterations).toBe(3);
	});

	it('hides the button zone without removing the button, the way an aborted run does', () => {
		store.addAbortButton(() => {});
		store.hideAll();

		expect(store.getButtonsVisible()).toBe(false);
		expect(store.getAbortHandler()).not.toBeNull();

		store.removeAbortButton();
		expect(store.getAbortHandler()).toBeNull();
	});
});
