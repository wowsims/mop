// What this pins is the split the dialog is built on: the stage is React state and everything that
// moves with a worker message is a DOM write. The measured rate is ~10 progress callbacks a second
// on wasm (sim/core/sim.go:336 throttles each sim to one report per 100 ms, and
// ui/domain/wasm/sim.ts:118 decimates by worker count) and ~2/s on the native host, so the reason
// for the refs is not the frequency — it is that `keepMounted` leaves this dialog in the page for
// the life of the tab.
import { act, fireEvent, render, screen } from '@testing-library/react';
import { Profiler, useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ElapsedTime } from './ElapsedTime';
import { ProgressTrackerDialog } from './ProgressTrackerDialog';
import type { ProgressTrackerHandle, ProgressTrackerState } from './types';

let handle: ProgressTrackerHandle | null = null;
let setStage: (state: ProgressTrackerState) => void = () => {};

const Harness = ({ open = true, onCancel }: { open?: boolean; onCancel?: () => void }) => {
	const [state, setState] = useState<ProgressTrackerState>({ stage: 'initializing' });
	setStage = setState;

	return (
		<ProgressTrackerDialog
			ref={value => {
				handle = value;
			}}
			open={open}
			title="Calculate Stat Weights"
			cssClass="ep-weights-progress"
			state={state}
			hasProgressBar
			onCancel={onCancel}
		/>
	);
};

const renderDialog = (props: { open?: boolean; onCancel?: () => void } = {}) => {
	const commits = vi.fn();
	const result = render(
		<Profiler id="progress" onRender={commits}>
			<Harness {...props} />
		</Profiler>,
	);
	return { commits, result };
};

const bar = () => screen.getByRole('progressbar');
const barText = () => document.querySelector('.progress-tracker-modal-progress-text')!;
const barTitle = () => document.querySelector('.progress-tracker-modal-progress-title')!;

describe('ProgressTrackerDialog', () => {
	beforeEach(() => {
		handle = null;
	});

	it('writes the caption, the bar and its text from setProgress', () => {
		renderDialog();
		act(() => handle!.setProgress({ title: '3 / 12 simulations complete', current: 30, total: 120 }));

		expect(barTitle().textContent).toBe('3 / 12 simulations complete');
		expect(barTitle().classList.contains('d-none')).toBe(false);
		expect(bar().style.getPropertyValue('--progress')).toBe('25');
		expect(bar().getAttribute('aria-valuenow')).toBe('30');
		expect(bar().getAttribute('aria-valuemax')).toBe('120');
		expect(bar().getAttribute('aria-valuemin')).toBe('0');
		expect(barText().textContent).toBe('30/120');
	});

	it('hides the bar and the caption while they have nothing to say', () => {
		renderDialog();
		act(() => handle!.setProgress({ title: '1 / 2', current: 1, total: 2 }));
		act(() => handle!.setProgress({}));

		expect(barTitle().classList.contains('d-none')).toBe(true);
		expect(bar().classList.contains('d-none')).toBe(true);
		expect(barText().classList.contains('d-none')).toBe(true);
	});

	// The rule the skill states as "sim progress bypasses the store". With the DOM writes above the
	// bound is zero, not merely small.
	it('renders not once for a hundred progress ticks, and shows the last of them', () => {
		const { commits } = renderDialog();
		const atMount = commits.mock.calls.length;

		act(() => {
			for (let i = 1; i <= 100; i++) handle!.setProgress({ title: `${i} / 100`, current: i, total: 100 });
		});

		expect(commits.mock.calls.length).toBe(atMount);
		expect(barText().textContent).toBe('100/100');
		expect(bar().style.getPropertyValue('--progress')).toBe('100');
	});

	// A consumer that keeps the dialog mounted between runs would otherwise open the next one showing
	// the last one's numbers.
	it('clears the bar when the next run opens it', () => {
		const view = render(<Harness />);
		act(() => handle!.setProgress({ title: '5 / 5 simulations complete', current: 5, total: 5 }));
		expect(barText().textContent).toBe('5/5');

		view.rerender(<Harness open={false} />);
		view.rerender(<Harness />);

		expect(barText().textContent).toBe('');
		expect(barText().classList.contains('d-none')).toBe(true);
		expect(barTitle().classList.contains('d-none')).toBe(true);
	});

	it('renders once for a stage transition', () => {
		const { commits } = renderDialog();
		const atMount = commits.mock.calls.length;

		act(() => setStage({ stage: 'complete', message: 'done' }));

		expect(commits.mock.calls.length).toBe(atMount + 1);
		expect(document.querySelector('.progress-tracker-modal-content')!.getAttribute('data-stage')).toBe('complete');
		const message = document.querySelector('.progress-tracker-modal-message')!;
		expect(message.textContent).toBe('done');
		expect(message.classList.contains('d-none')).toBe(false);
	});

	it('hides the message while there is none', () => {
		renderDialog();
		expect(document.querySelector('.progress-tracker-modal-message')!.classList.contains('d-none')).toBe(true);
	});

	it('cannot be closed, and cancels through its own button', () => {
		const onCancel = vi.fn();
		renderDialog({ onCancel });

		expect(screen.queryByRole('button', { name: 'Close' })).toBeNull();
		fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
		expect(screen.getByRole('dialog')).toBeTruthy();

		const cancel = document.querySelector<HTMLButtonElement>('button.progress-tracker-modal-cancel-btn')!;
		expect(cancel.getAttribute('type')).toBe('button');
		fireEvent.click(cancel);
		expect(onCancel).toHaveBeenCalledTimes(1);
	});

	it('renders no cancel button when there is nothing to cancel', () => {
		renderDialog();
		expect(document.querySelector('button.progress-tracker-modal-cancel-btn')).toBeNull();
	});

	it('names the dialog from its title, and keeps it mounted but hidden while closed', () => {
		renderDialog();
		expect(screen.getByRole('dialog', { name: 'Calculate Stat Weights' })).toBeTruthy();

		screen.getByRole('dialog').remove();
		renderDialog({ open: false });
		const popup = document.querySelector('.progress-tracker-dialog')!;
		expect(popup.classList.contains('sim-dialog-popup--md')).toBe(true);
		expect(popup.hasAttribute('hidden')).toBe(true);
	});
});

describe('ElapsedTime', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	const text = () => document.querySelector('.time-elapsed')!.textContent;

	it('ticks the readout without rendering', () => {
		const commits = vi.fn();
		render(
			<Profiler id="elapsed" onRender={commits}>
				<ElapsedTime running />
			</Profiler>,
		);
		const atMount = commits.mock.calls.length;
		expect(text()).toBe('0s');

		act(() => {
			vi.advanceTimersByTime(2400);
		});

		expect(text()).toBe('2s');
		expect(commits.mock.calls.length).toBe(atMount);
	});

	// `keepMounted` is what makes this a leak rather than a tidy-up: without the cleanup the interval
	// outlives every run and keeps writing for the life of the page.
	it('stops its interval when the dialog closes and when it unmounts', () => {
		const { rerender, unmount } = render(<ElapsedTime running />);
		act(() => {
			vi.advanceTimersByTime(1400);
		});
		expect(text()).toBe('1s');

		rerender(<ElapsedTime running={false} />);
		act(() => {
			vi.advanceTimersByTime(5000);
		});
		expect(text()).toBe('1s');
		expect(vi.getTimerCount()).toBe(0);

		rerender(<ElapsedTime running />);
		expect(text()).toBe('0s');
		act(() => {
			vi.advanceTimersByTime(1400);
		});
		expect(text()).toBe('1s');
		unmount();
		expect(vi.getTimerCount()).toBe(0);
	});

	it('runs no timer while the dialog is closed', () => {
		render(<ElapsedTime running={false} />);
		act(() => {
			vi.advanceTimersByTime(5000);
		});
		expect(text()).toBe('0s');
		expect(vi.getTimerCount()).toBe(0);
	});
});
