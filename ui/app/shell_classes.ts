import { showsEpRatios } from '@features/results/model/sim_results';
import type { PlayerSpec } from '@sim/player/player_spec';
import clsx from 'clsx';

export { showsEpRatios };

export interface SimUiClassesArgs {
	className: string;
	spec: PlayerSpec<any>;
}

export const simUiClasses = ({ className }: SimUiClassesArgs): string => clsx('sim-ui', 'group/sim', className);

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
