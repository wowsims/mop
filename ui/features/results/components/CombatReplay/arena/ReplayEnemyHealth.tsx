import { useRef } from 'react';

import { useReplayFrame } from '../../../hooks/useReplayFrame';
import type { ReplayEnemy } from '../../../model/replay';
import { healthFractionAt } from '../../../model/replay';

export interface ReplayEnemyHealthProps {
	enemy: ReplayEnemy;
}

/** The bar drains on every landed hit, so it is written straight into its two nodes rather than rendered. */
export const ReplayEnemyHealth = ({ enemy }: ReplayEnemyHealthProps) => {
	const fill = useRef<HTMLDivElement>(null);
	const text = useRef<HTMLSpanElement>(null);

	useReplayFrame(time => {
		const fraction = healthFractionAt(enemy, time);
		if (fill.current) fill.current.style.width = `${fraction * 100}%`;
		if (text.current) text.current.textContent = `${(fraction * 100).toFixed(1)}%`;
	});

	return (
		<div className="relative h-2 overflow-hidden rounded-sm bg-white/10">
			<div ref={fill} data-testid="cr-hp-fill" className="h-full rounded-sm bg-cr-hp-fill transition-[width] duration-50 ease-linear" />
			<span
				ref={text}
				data-testid="cr-hp-text"
				className="absolute inset-0 flex items-center justify-center text-[7px] font-bold text-white text-shadow-outline-sm"
			/>
		</div>
	);
};
