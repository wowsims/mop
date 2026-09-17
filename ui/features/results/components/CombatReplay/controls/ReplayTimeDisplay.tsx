import { useRef } from 'react';

import { useReplayFrame } from '../../../hooks/useReplayFrame';
import { replayTimeLabel } from '../../../model/replay';

export interface ReplayTimeDisplayProps {
	duration: number;
}

export const ReplayTimeDisplay = ({ duration }: ReplayTimeDisplayProps) => {
	const label = useRef<HTMLSpanElement>(null);

	useReplayFrame(time => {
		if (label.current) label.current.textContent = replayTimeLabel(time, duration);
	});

	return <span ref={label} data-testid="cr-time-display" className="ml-auto text-[0.75rem] text-white/60 tabular-nums" />;
};
