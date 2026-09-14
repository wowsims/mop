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
		<div className="relative h-4.5 min-h-4.5 shrink-0 overflow-hidden rounded-sm bg-white-7">
			<div ref={fill} data-testid="cr-cast-bar-fill" className="h-full w-0 rounded-sm bg-cr-cast-fill transition-[width] duration-50 ease-linear" />
			<div
				ref={label}
				data-testid="cr-cast-bar-label"
				className="absolute inset-0 flex items-center justify-center text-[0.7rem] font-semibold text-white text-shadow-outline-md pointer-events-none"
			/>
			<div
				ref={remaining}
				data-testid="cr-cast-bar-time"
				className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[0.65rem] text-white-75 pointer-events-none"
			/>
		</div>
	);
};
