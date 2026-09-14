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
	'absolute top-1/2 bottom-0 z-(--cr-card-z,1) flex max-h-full flex-col items-center gap-[10px] pointer-events-auto origin-bottom left-(--cr-card-x) w-(--cr-card-w) [transform:translate(-50%,-50%)_scale(var(--cr-card-scale,1))] brightness-(--cr-card-brightness,1)';

export const ReplayEnemyCard = ({ enemy, layout }: ReplayEnemyCardProps) => (
	<div className={CARD_CLASSES} data-testid="cr-enemy-card" data-idx={enemy.index} style={cardVars(layout)}>
		<div className="relative z-2 w-full rounded-md bg-black-55 px-1.5 py-1">
			<div data-testid="cr-enemy-name" className="mb-0.75 overflow-hidden text-ellipsis whitespace-nowrap text-center text-xs font-semibold text-danger">
				{enemy.name}
			</div>
			<ReplayEnemyHealth enemy={enemy} />
			<ReplayAuraIcons testId="cr-debuff-row" className="flex flex-wrap gap-1 mt-0.75 min-h-0" auras={enemy.auras} />
		</div>
		<div className="relative flex w-full shrink items-end justify-center">
			<img
				src={BOSS_IMAGE_URL}
				alt={enemy.name}
				draggable={false}
				className="block h-auto w-full max-h-[min(260px,45vh)] select-none object-contain object-bottom drop-shadow-cr-silhouette"
			/>
			<ReplayHitLayer enemy={enemy} />
		</div>
	</div>
);
