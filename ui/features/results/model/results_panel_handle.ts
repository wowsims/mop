import type { ProgressMetrics } from '@generated/proto/api';

export interface ResultsPanelHandle {
	showResult(): void;
	setProgress(progress: ProgressMetrics): void;
	setPending(): void;
	hideAll(): void;
	addAbortButton(abortClicked: (event: MouseEvent) => void): void;
	removeAbortButton(): void;
}
