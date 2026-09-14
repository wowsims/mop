import { showsEpRatios } from '@features/results/model/sim_results';
import type { PlayerSpec } from '@sim/player/player_spec';
import clsx from 'clsx';

export { showsEpRatios };

export const simTypeClasses = (spec: PlayerSpec<any>): string =>
	clsx(
		spec.isHealingSpec && 'sim-type--heal',
		!spec.isHealingSpec && spec.isTankSpec && 'sim-type--tank',
		!spec.isHealingSpec && !spec.isTankSpec && (spec.isMeleeDpsSpec || spec.isRangedDpsSpec) && 'sim-type--dps',
		!spec.isHealingSpec && !spec.isTankSpec && spec.isMeleeDpsSpec && 'sim-type--melee',
		!spec.isHealingSpec && !spec.isTankSpec && !spec.isMeleeDpsSpec && spec.isRangedDpsSpec && 'sim-type--ranged',
	);

export interface SimUiClassesArgs {
	className: string;
	spec: PlayerSpec<any>;
}

export const simUiClasses = ({ className, spec }: SimUiClassesArgs): string => clsx('sim-ui', 'group/sim', className, simTypeClasses(spec));

export interface SimUiAttributesArgs {
	spec: PlayerSpec<any>;
}

export const simUiAttributes = ({ spec }: SimUiAttributesArgs): Record<string, string | undefined> => {
	const simType = spec.isHealingSpec ? 'heal' : spec.isTankSpec ? 'tank' : spec.isMeleeDpsSpec || spec.isRangedDpsSpec ? 'dps' : undefined;
	const simAttack = simType === 'dps' ? (spec.isMeleeDpsSpec ? 'melee' : 'ranged') : undefined;

	return {
		'data-sim-type': simType,
		'data-sim-attack': simAttack,
	};
};
