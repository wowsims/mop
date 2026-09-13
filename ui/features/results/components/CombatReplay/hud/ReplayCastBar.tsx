import { useRef } from 'react';

import { useReplayFrame } from '../../../hooks/useReplayFrame';
import type { ReplayAction } from '../../../model/replay';
import { castBarFrame } from '../../../model/replay';

export interface ReplayCastBarProps {
	actions: ReadonlyArray<ReplayAction>;
	duration: number;
}

/** The one thing on screen that really does change on every frame: the fill sweeps as the cast runs. */
export const ReplayCastBar = ({ actions, duration }: ReplayCastBarProps) => {
	const fill = useRef<HTMLDivElement>(null);
	const label = useRef<HTMLDivElement>(null);
	const remaining = useRef<HTMLDivElement>(null);

	useReplayFrame(time => {
		const frame = castBarFrame(actions, duration, time);
		if (fill.current) fill.current.style.width = frame.width;
		if (label.current) label.current.textContent = frame.label;
		if (remaining.current) remaining.current.textContent = frame.remaining;
	});

	return (
		<div className="cr-cast-bar-container relative h-[18px] min-h-[18px] shrink-0 overflow-hidden rounded-sm bg-white-7">
			<div ref={fill} className="cr-cast-bar-fill h-full w-0 rounded-sm bg-cr-cast-fill transition-[width] duration-[50ms] ease-linear" />
			<div
				ref={label}
				className="cr-cast-bar-label absolute inset-0 flex items-center justify-center text-[0.7rem] font-semibold text-white [text-shadow:1px_1px_4px_var(--color-black)] pointer-events-none"
			/>
			<div ref={remaining} className="cr-cast-bar-time absolute right-[6px] top-1/2 -translate-y-1/2 text-[0.65rem] text-white-75 pointer-events-none" />
		</div>
	);
};
