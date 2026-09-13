import { cssVars } from '@ui-kit/utils/css';

import type { ReplayCardLayout, ReplayEnemy } from '../../../model/replay';
import { ReplayAuraIcons } from '../hud/ReplayAuraIcons';
import { ReplayEnemyHealth } from './ReplayEnemyHealth';
import { ReplayHitLayer } from './ReplayHitLayer';

const BOSS_IMAGE_URL = '/mop/assets/img/boss_patchwerk.webp';

/** The card's place in the formation, handed to the stylesheet so the depth stays one transform. */
const cardVars = (layout: ReplayCardLayout) =>
	cssVars({
		'--cr-card-x': `${layout.xPct}%`,
		'--cr-card-w': `${layout.widthPct}%`,
		'--cr-card-scale': layout.scale.toFixed(3),
		'--cr-card-z': String(Math.round(layout.scale * 10)),
		'--cr-card-brightness': (0.6 + 0.4 * layout.scale).toFixed(2),
	});

export interface ReplayEnemyCardProps {
	enemy: ReplayEnemy;
	layout: ReplayCardLayout;
}

export const ReplayEnemyCard = ({ enemy, layout }: ReplayEnemyCardProps) => (
	<div className="cr-enemy-card" data-idx={enemy.index} style={cardVars(layout)}>
		<div className="cr-nameplate">
			<div className="cr-enemy-name">{enemy.name}</div>
			<ReplayEnemyHealth enemy={enemy} />
			<ReplayAuraIcons className="cr-debuff-row" auras={enemy.auras} />
		</div>
		<div className="cr-silhouette">
			<img src={BOSS_IMAGE_URL} alt={enemy.name} draggable={false} />
			<ReplayHitLayer enemy={enemy} />
		</div>
	</div>
);
