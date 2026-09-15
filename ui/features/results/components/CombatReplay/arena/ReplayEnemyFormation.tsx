import { useMemo } from 'react';

import type { ReplayEnemy } from '../../../model/replay';
import { enemyFormation } from '../../../model/replay';
import { ReplayEnemyCard } from './ReplayEnemyCard';

export interface ReplayEnemyFormationProps {
	enemies: ReadonlyArray<ReplayEnemy>;
	/** Targets the formation does not draw, reported as a `+N` in the corner. */
	hiddenCount: number;
}

export const ReplayEnemyFormation = ({ enemies, hiddenCount }: ReplayEnemyFormationProps) => {
	const layout = useMemo(() => enemyFormation(enemies.length), [enemies.length]);

	return (
		<div className="pointer-events-none absolute inset-x-0 top-0 h-full">
			{layout.map(card => (
				<ReplayEnemyCard key={card.index} enemy={enemies[card.index]} layout={card} />
			))}
			{hiddenCount > 0 && <div className="absolute right-2.5 bottom-2 self-center text-[1.2rem] font-bold text-white-50">+{hiddenCount}</div>}
		</div>
	);
};
