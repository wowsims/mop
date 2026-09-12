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
		<div className="cr-enemy-formation">
			{layout.map(card => (
				<ReplayEnemyCard key={card.index} enemy={enemies[card.index]} layout={card} />
			))}
			{hiddenCount > 0 && <div className="cr-enemy-more">+{hiddenCount}</div>}
		</div>
	);
};
