import type { CSSProperties } from 'react';
import { useRef } from 'react';

import { useReplayFrame } from '../../../hooks/useReplayFrame';
import type { ReplayResourceRow } from '../../../model/replay';
import { resourceValueAt } from '../../../model/replay';

const barStyle = (row: ReplayResourceRow): CSSProperties => ({
	background: `linear-gradient(90deg,${row.color}88,${row.color}dd)`,
	boxShadow: `0 0 10px ${row.color}55`,
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
		<div className="cr-resource-wrap">
			<div className="cr-res-bar-outer">
				<div ref={fill} className="cr-res-bar-fill" style={barStyle(row)} />
				<span className="cr-bar-label">{row.label}</span>
				<span ref={value} className="cr-bar-val" />
			</div>
		</div>
	);
};
