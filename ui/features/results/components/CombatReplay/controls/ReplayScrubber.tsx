import { useRef } from 'react';

import { useReplayFrame } from '../../../hooks/useReplayFrame';
import { scrubberTime, scrubberValue } from '../../../model/replay';

export interface ReplayScrubberProps {
	duration: number;
	onScrubStart: () => void;
	onSeek: (time: number) => void;
}

/**
 * Uncontrolled on purpose: the playhead writes the position sixty times a second, which is exactly the
 * per-frame `setState` a controlled input would need.
 */
export const ReplayScrubber = ({ duration, onScrubStart, onSeek }: ReplayScrubberProps) => {
	const input = useRef<HTMLInputElement>(null);

	useReplayFrame(time => {
		if (input.current) input.current.value = String(scrubberValue(time, duration));
	});

	return (
		<input
			ref={input}
			type="range"
			className="cr-scrubber"
			min="0"
			max="1000"
			step="1"
			defaultValue="0"
			onMouseDown={onScrubStart}
			onChange={event => onSeek(scrubberTime(parseInt(event.currentTarget.value), duration))}
		/>
	);
};
