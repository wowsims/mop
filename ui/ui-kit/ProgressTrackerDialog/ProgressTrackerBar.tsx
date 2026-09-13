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
		<div className="relative flex w-full max-w-[250px] flex-col gap-1 self-center">
			{title && (
				<div className="mb-2" data-testid="progress-tracker-modal-progress-title">
					{title}
				</div>
			)}
			<Progress.Root value={rounded} max={total}>
				<Progress.Track className="flex h-[12px] w-full overflow-hidden rounded-sm bg-surface-border">
					<Progress.Indicator
						className="animate-shimmer bg-progress bg-[length:200%_100%] motion-reduce:animate-none data-[indeterminate]:hidden"
						data-testid="progress-tracker-bar-indicator"
					/>
				</Progress.Track>
			</Progress.Root>
			{measured && <div className="text-right text-xs text-border" data-testid="progress-tracker-modal-progress-text">{`${rounded}/${total}`}</div>}
		</div>
	);
};
