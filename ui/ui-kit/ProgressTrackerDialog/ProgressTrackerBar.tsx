import { type Ref, useCallback, useEffect, useImperativeHandle, useRef } from 'react';

import type { ProgressTrackerHandle, ProgressTrackerProgress } from './types';

export interface ProgressTrackerBarProps {
	running: boolean;
	ref?: Ref<ProgressTrackerHandle>;
}

/** The bar is written imperatively: `setProgress` is called from a worker progress callback, and reconciling it would render the whole dialog per tick. */
export const ProgressTrackerBar = ({ running, ref }: ProgressTrackerBarProps) => {
	const caption = useRef<HTMLDivElement>(null);
	const bar = useRef<HTMLDivElement>(null);
	const text = useRef<HTMLDivElement>(null);

	const setProgress = useCallback(({ title, current, total }: ProgressTrackerProgress) => {
		caption.current?.classList.toggle('d-none', !title);
		if (caption.current) caption.current.textContent = title ?? '';

		const measured = current !== undefined && total !== undefined;
		bar.current?.classList.toggle('d-none', !measured);
		text.current?.classList.toggle('d-none', !measured);
		if (!measured) {
			if (text.current) text.current.textContent = '';
			return;
		}

		const rounded = Math.ceil(current);
		bar.current?.style.setProperty('--progress', String((current / total) * 100));
		bar.current?.setAttribute('aria-valuenow', String(rounded));
		bar.current?.setAttribute('aria-valuemax', String(total));
		if (text.current) text.current.textContent = `${rounded}/${total}`;
	}, []);

	useImperativeHandle(ref, () => ({ setProgress }), [setProgress]);

	useEffect(() => {
		if (running) setProgress({});
	}, [running, setProgress]);

	return (
		<div className="progress-tracker-modal-progress-container">
			<div ref={caption} className="progress-tracker-modal-progress-title mb-2 d-none" />
			<div className="progress">
				<div ref={bar} className="progress-bar d-none" role="progressbar" aria-valuemin={0} />
			</div>
			<div ref={text} className="progress-tracker-modal-progress-text d-none" />
		</div>
	);
};
