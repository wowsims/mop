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

const CARD_CLASSES =
	'absolute top-1/2 bottom-0 z-(--cr-card-z,1) flex max-h-full flex-col items-center gap-2.5 pointer-events-auto origin-bottom left-(--cr-card-x) w-(--cr-card-w) ui-cr-card-transform brightness-(--cr-card-brightness,1)';

export const ReplayEnemyCard = ({ enemy, layout }: ReplayEnemyCardProps) => (
	<div className={CARD_CLASSES} data-testid="cr-enemy-card" data-idx={enemy.index} style={cardVars(layout)}>
		<div className="relative z-2 w-full rounded-md bg-black-55 px-1.5 py-1">
			<div data-testid="cr-enemy-name" className="mb-0.75 overflow-hidden text-center text-xs font-semibold text-ellipsis whitespace-nowrap text-danger">
				{enemy.name}
			</div>
			<ReplayEnemyHealth enemy={enemy} />
			<ReplayAuraIcons testId="cr-debuff-row" className="mt-0.75 flex min-h-0 flex-wrap gap-1" auras={enemy.auras} />
		</div>
		<div className="relative flex w-full shrink items-end justify-center">
			<img
				src={BOSS_IMAGE_URL}
				alt={enemy.name}
				draggable={false}
				className="block h-auto max-h-[min(260px,45vh)] w-full object-contain object-bottom drop-shadow-cr-silhouette select-none"
			/>
			<ReplayHitLayer enemy={enemy} />
		</div>
	</div>
);
