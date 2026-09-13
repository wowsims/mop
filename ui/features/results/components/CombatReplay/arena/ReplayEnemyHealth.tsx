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
		<div className="cr-hp-bar">
			<div ref={fill} className="cr-hp-fill" />
			<span ref={text} className="cr-hp-text" />
		</div>
	);
};
