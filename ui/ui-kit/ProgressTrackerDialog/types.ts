import type { ReactNode } from 'react';

/** The discrete half: a handful of transitions per run, so React state. */
export interface ProgressTrackerState {
	stage: 'initializing' | 'complete' | 'error' | string;
	message?: ReactNode;
}

/** The continuous half: written straight to the DOM through `ProgressTrackerHandle`, never through state. */
export interface ProgressTrackerProgress {
	title?: string;
	current?: number;
	total?: number;
}

export interface ProgressTrackerHandle {
	setProgress: (progress: ProgressTrackerProgress) => void;
}
