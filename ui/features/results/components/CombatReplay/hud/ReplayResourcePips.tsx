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
		<div className="cr-resource-wrap cr-resource-dot ui-combat-replay-resource-wrap w-full gap-[6px]">
			<span className="cr-dot-label shrink-0 whitespace-nowrap text-[0.6rem] font-semibold text-white-70">{row.label}</span>
			<div ref={bar} className="cr-seg-bar flex h-[12px] flex-1 items-stretch gap-[3px]" style={pipVars(row)}>
				{Array.from({ length: total }, (_, index) => (
					<div
						key={index}
						className="cr-segment h-full min-w-0 flex-1 rounded-[3px] bg-white-7 data-filled:bg-[linear-gradient(180deg,var(--cr-segment-from),var(--cr-segment-to))] data-filled:shadow-[0_0_8px_var(--cr-segment-glow)]"
					/>
				))}
			</div>
			<span ref={value} className="cr-dot-val shrink-0 whitespace-nowrap text-[0.6rem] text-white-60" />
		</div>
	);
};
