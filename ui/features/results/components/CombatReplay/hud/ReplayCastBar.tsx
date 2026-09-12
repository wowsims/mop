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
		<div className="cr-cast-bar-container">
			<div ref={fill} className="cr-cast-bar-fill" />
			<div ref={label} className="cr-cast-bar-label" />
			<div ref={remaining} className="cr-cast-bar-time" />
		</div>
	);
};
