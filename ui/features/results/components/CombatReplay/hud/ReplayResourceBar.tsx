import { cssVars } from '@ui-kit/utils/css';
import { useRef } from 'react';

import { useReplayFrame } from '../../../hooks/useReplayFrame';
import type { ReplayResourceRow } from '../../../model/replay';
import { resourceValueAt } from '../../../model/replay';

const barVars = (row: ReplayResourceRow) =>
	cssVars({
		'--cr-resbar-from': `${row.color}88`,
		'--cr-resbar-to': `${row.color}dd`,
		'--cr-resbar-glow': `${row.color}55`,
	});

export interface ReplayResourceBarProps {
	row: ReplayResourceRow;
}

export const ReplayResourceBar = ({ row }: ReplayResourceBarProps) => {
	const fill = useRef<HTMLDivElement>(null);
	const value = useRef<HTMLSpanElement>(null);

	useReplayFrame(time => {
		const current = resourceValueAt(row.samples, time);
		if (fill.current) fill.current.style.width = `${(row.maxValue > 0 ? Math.min(1, Math.max(0, current / row.maxValue)) : 0) * 100}%`;
		if (value.current) value.current.textContent = `${Math.round(current)}/${Math.round(row.maxValue)}`;
	});

	return (
		<div className="ui-combat-replay-resource-wrap">
			<div className="relative h-3 w-full overflow-hidden rounded-sm bg-white-7">
				<div
					ref={fill}
					data-testid="cr-res-bar-fill"
					className="h-full rounded-sm bg-cr-resbar-fill shadow-glow-10 shadow-(color:--cr-resbar-glow) transition-[width] duration-50 ease-linear"
					style={barVars(row)}
				/>
				<span
					data-testid="cr-bar-label"
					className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[0.6rem] font-semibold text-white-80 pointer-events-none">
					{row.label}
				</span>
				<span
					ref={value}
					data-testid="cr-bar-val"
					className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[0.6rem] text-white-70 pointer-events-none"
				/>
			</div>
		</div>
	);
};
