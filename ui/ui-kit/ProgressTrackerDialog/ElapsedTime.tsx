import { formatDurationSeconds } from '@domain/format';
import { useEffect, useRef } from 'react';

export interface ElapsedTimeProps {
	running: boolean;
}

const TICK_MS = 100;
const ZERO = formatDurationSeconds(0);

/** `textContent` rather than state: the dialog is `keepMounted`, so a ticking `setState` would render it ten times a second for as long as the page lives. */
export const ElapsedTime = ({ running }: ElapsedTimeProps) => {
	const elapsed = useRef<HTMLSpanElement>(null);

	useEffect(() => {
		if (!running) return;
		const start = Date.now();
		if (elapsed.current) elapsed.current.textContent = ZERO;
		const timer = window.setInterval(() => {
			if (elapsed.current) elapsed.current.textContent = formatDurationSeconds((Date.now() - start) / 1000);
		}, TICK_MS);
		return () => window.clearInterval(timer);
	}, [running]);

	return (
		<span ref={elapsed} className="time-elapsed">
			{ZERO}
		</span>
	);
};
