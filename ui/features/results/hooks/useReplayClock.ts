import { useCallback, useEffect, useRef, useState } from 'react';

export type ReplayPainter = (time: number) => void;

/** The playhead itself. Stable for the life of the replay, so subscribing to it never resubscribes. */
export interface ReplayFrames {
	getTime: () => number;
	/** Registers a painter. Not called on registration — `useReplayFrame` paints from its own layout effect. */
	subscribe: (paint: ReplayPainter) => () => void;
}

export interface ReplayClock {
	frames: ReplayFrames;
	duration: number;
	playing: boolean;
	rate: number;
	setRate: (rate: number) => void;
	play: () => void;
	pause: () => void;
	seekTo: (time: number) => void;
	seekBy: (delta: number) => void;
}

/**
 * Drives the replay at wall-clock speed. The playhead lives in a ref and reaches the DOM through
 * painters rather than through state: a 60fps `setState` would re-render the whole scene every frame,
 * and the scene only changes when a cast or an aura crosses the playhead. What React does hold is the
 * transport — playing, and the rate — which changes only when someone presses a button.
 */
export const useReplayClock = (duration: number): ReplayClock => {
	const [playing, setPlaying] = useState(false);
	const [rate, setRate] = useState(1);

	const time = useRef(0);
	const painters = useRef(new Set<ReplayPainter>());
	const durationRef = useRef(duration);
	durationRef.current = duration;
	const rateRef = useRef(rate);
	rateRef.current = rate;

	const frames = useRef<ReplayFrames>({
		getTime: () => time.current,
		subscribe: paint => {
			painters.current.add(paint);
			return () => {
				painters.current.delete(paint);
			};
		},
	}).current;

	const seekTo = useCallback((next: number) => {
		time.current = Math.max(0, Math.min(next, durationRef.current));
		painters.current.forEach(paint => paint(time.current));
	}, []);

	const seekBy = useCallback((delta: number) => seekTo(time.current + delta), [seekTo]);

	const pause = useCallback(() => setPlaying(false), []);

	const play = useCallback(() => {
		// Pressing play on a finished fight restarts it rather than doing nothing.
		if (time.current >= durationRef.current) seekTo(0);
		setPlaying(true);
	}, [seekTo]);

	useEffect(() => {
		if (!playing) return;
		let frame = 0;
		let previous: number | null = null;

		const tick = (timestamp: number) => {
			if (previous !== null) {
				const next = time.current + ((timestamp - previous) / 1000) * rateRef.current;
				if (next >= durationRef.current) {
					seekTo(durationRef.current);
					setPlaying(false);
					return;
				}
				seekTo(next);
			}
			previous = timestamp;
			frame = requestAnimationFrame(tick);
		};

		frame = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(frame);
	}, [playing, seekTo]);

	return { frames, duration, playing, rate, setRate, play, pause, seekTo, seekBy };
};
