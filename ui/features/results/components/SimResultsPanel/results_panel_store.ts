import type { ResultsPanelHandle } from '@features/results/model/results_panel_handle';
import type { ProgressMetrics } from '@generated/proto/api';
import { flushSync } from 'react-dom';

export enum ResultsPanelStage {
	Idle = 'idle',
	Pending = 'pending',
	Running = 'running',
	Result = 'result',
}

/** Stage and the Stop button are React state; the progress numbers are DOM writes through `onProgress`, and `latestProgress` sits outside the snapshot so the block tick one mounts can read the values that mounted it. `notify` is `flushSync` because the run action reads the panel back in the click's own task. */
export class ResultsPanelStore implements ResultsPanelHandle {
	latestProgress: ProgressMetrics | null = null;

	private stage: ResultsPanelStage = ResultsPanelStage.Idle;
	private abortHandler: ((event: MouseEvent) => void) | null = null;
	private buttonsVisible = false;
	private readonly listeners = new Set<() => void>();
	private progressListener: ((progress: ProgressMetrics) => void) | null = null;

	readonly subscribe = (listener: () => void): (() => void) => {
		this.listeners.add(listener);
		return () => {
			this.listeners.delete(listener);
		};
	};

	readonly getStage = (): ResultsPanelStage => this.stage;

	readonly getAbortHandler = (): ((event: MouseEvent) => void) | null => this.abortHandler;

	readonly getButtonsVisible = (): boolean => this.buttonsVisible;

	onProgress(listener: (progress: ProgressMetrics) => void): () => void {
		this.progressListener = listener;
		return () => {
			if (this.progressListener === listener) this.progressListener = null;
		};
	}

	setPending() {
		this.latestProgress = null;
		this.setStage(ResultsPanelStage.Pending);
	}

	setProgress(progress: ProgressMetrics) {
		this.latestProgress = progress;
		// A tick landing before the block commits finds no listener; the block's mount effect reads `latestProgress` instead.
		if (this.stage === ResultsPanelStage.Running) this.progressListener?.(progress);
		else this.setStage(ResultsPanelStage.Running);
	}

	showResult() {
		this.setStage(ResultsPanelStage.Result);
	}

	hideAll() {
		this.buttonsVisible = false;
		this.setStage(ResultsPanelStage.Idle);
	}

	addAbortButton(abortClicked: (event: MouseEvent) => void) {
		this.abortHandler = abortClicked;
		this.buttonsVisible = true;
		this.notify();
	}

	removeAbortButton() {
		this.abortHandler = null;
		this.buttonsVisible = false;
		this.notify();
	}

	private setStage(stage: ResultsPanelStage) {
		this.stage = stage;
		this.notify();
	}

	private notify() {
		flushSync(() => this.listeners.forEach(listener => listener()));
	}
}
