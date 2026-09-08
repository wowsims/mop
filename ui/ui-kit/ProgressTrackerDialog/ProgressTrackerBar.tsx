import { Progress } from '@base-ui/react/progress';
import { type Ref, useEffect, useImperativeHandle, useState } from 'react';

import type { ProgressTrackerHandle, ProgressTrackerProgress } from './types';

export interface ProgressTrackerBarProps {
	running: boolean;
	ref?: Ref<ProgressTrackerHandle>;
}

/** One shared object, so resetting an already-unmeasured bar bails out instead of committing. */
const UNMEASURED: ProgressTrackerProgress = {};

/** `setProgress` is called from a worker progress callback, so it stays out of the store: a tick renders this leaf, never the dialog. */
export const ProgressTrackerBar = ({ running, ref }: ProgressTrackerBarProps) => {
	const [{ title, current, total }, setProgress] = useState<ProgressTrackerProgress>(UNMEASURED);

	useImperativeHandle(ref, () => ({ setProgress }), [setProgress]);

	useEffect(() => {
		if (running) setProgress(UNMEASURED);
	}, [running, setProgress]);

	const measured = current !== undefined && total !== undefined;
	const rounded = measured ? Math.ceil(current) : null;

	return (
		<div className="progress-tracker-modal-progress-container">
			{title && <div className="progress-tracker-modal-progress-title mb-2">{title}</div>}
			<Progress.Root value={rounded} max={total}>
				<Progress.Track className="progress-tracker-bar-track">
					<Progress.Indicator className="progress-tracker-bar-indicator" />
				</Progress.Track>
			</Progress.Root>
			{measured && <div className="progress-tracker-modal-progress-text">{`${rounded}/${total}`}</div>}
		</div>
	);
};
