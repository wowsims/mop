import { cssVars } from '@ui-kit/utils/css';
import { useRef } from 'react';

import { useReplayFrame } from '../../../hooks/useReplayFrame';
import type { ReplayResourceRow } from '../../../model/replay';
import { resourceValueAt } from '../../../model/replay';

/** A pip's lit look, as custom properties: filling a pip is then one attribute, not a per-frame style write. */
const pipVars = (row: ReplayResourceRow) =>
	cssVars({
		'--cr-segment-from': `${row.color}ee`,
		'--cr-segment-to': `${row.color}99`,
		'--cr-segment-glow': `${row.color}88`,
	});

export interface ReplayResourcePipsProps {
	row: ReplayResourceRow;
}

/** Combo points, chi and runes come in whole units, so they are pips rather than a bar. */
export const ReplayResourcePips = ({ row }: ReplayResourcePipsProps) => {
	const bar = useRef<HTMLDivElement>(null);
	const value = useRef<HTMLSpanElement>(null);
	const total = Math.round(row.maxValue);

	useReplayFrame(time => {
		const filled = Math.round(resourceValueAt(row.samples, time));
		if (value.current) value.current.textContent = `${filled}/${total}`;
		const pips = bar.current?.children;
		if (!pips) return;
		for (let index = 0; index < pips.length; index++) {
			pips[index].toggleAttribute('data-filled', index < filled);
		}
	});

	return (
		<div className="ui-combat-replay-resource-wrap w-full gap-1.5">
			<span data-testid="cr-dot-label" className="shrink-0 text-[0.6rem] font-semibold whitespace-nowrap text-white-70">
				{row.label}
			</span>
			<div ref={bar} className="flex h-3 flex-1 items-stretch gap-0.75" style={pipVars(row)}>
				{Array.from({ length: total }, (_, index) => (
					<div
						key={index}
						data-testid="cr-segment"
						className="h-full min-w-0 flex-1 rounded-xs bg-white-7 data-filled:bg-cr-segment-fill data-filled:shadow-glow-8 data-filled:shadow-(color:--cr-segment-glow)"
					/>
				))}
			</div>
			<span ref={value} data-testid="cr-dot-val" className="shrink-0 text-[0.6rem] whitespace-nowrap text-white-60" />
		</div>
	);
};
