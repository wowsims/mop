import { hideMetricsClassName } from '@features/results/model/sim_results';
import type { PlayerSpec } from '@sim/player/player_spec';
import clsx from 'clsx';

export interface MetricVisibility {
	damage: boolean;
	threat: boolean;
	healing: boolean;
	epRatios: boolean;
	experimental: boolean;
}

export const simTypeClasses = (spec: PlayerSpec<any>): string =>
	clsx(
		spec.isHealingSpec && 'sim-type--heal',
		!spec.isHealingSpec && spec.isTankSpec && 'sim-type--tank',
		!spec.isHealingSpec && !spec.isTankSpec && (spec.isMeleeDpsSpec || spec.isRangedDpsSpec) && 'sim-type--dps',
		!spec.isHealingSpec && !spec.isTankSpec && spec.isMeleeDpsSpec && 'sim-type--melee',
		!spec.isHealingSpec && !spec.isTankSpec && !spec.isMeleeDpsSpec && spec.isRangedDpsSpec && 'sim-type--ranged',
	);

/** EP ratios are a column *comparison*, so they only mean something when more than one column is on. */
export const showsEpRatios = (metrics: { damage: boolean; threat: boolean; healing: boolean }): boolean =>
	metrics.threat || (metrics.damage && metrics.healing);

export const metricVisibilityClasses = (metrics: MetricVisibility): string =>
	clsx(
		!metrics.damage && hideMetricsClassName('damage'),
		!metrics.threat && hideMetricsClassName('threat'),
		!metrics.healing && hideMetricsClassName('healing'),
		!metrics.epRatios && 'hide-ep-ratios',
		!metrics.experimental && 'hide-experimental',
	);

export interface SimUiClassesArgs {
	className: string;
	spec: PlayerSpec<any>;
	metrics: MetricVisibility;
}

export const simUiClasses = ({ className, spec, metrics }: SimUiClassesArgs): string =>
	clsx('sim-ui', 'group/sim', className, simTypeClasses(spec), metricVisibilityClasses(metrics));

export interface SimUiAttributesArgs {
	spec: PlayerSpec<any>;
	metrics: MetricVisibility;
}

export const simUiAttributes = ({ spec, metrics }: SimUiAttributesArgs): Record<string, string | undefined> => {
	const simType = spec.isHealingSpec ? 'heal' : spec.isTankSpec ? 'tank' : spec.isMeleeDpsSpec || spec.isRangedDpsSpec ? 'dps' : undefined;
	const simAttack = simType === 'dps' ? (spec.isMeleeDpsSpec ? 'melee' : 'ranged') : undefined;

	return {
		'data-sim-type': simType,
		'data-sim-attack': simAttack,
		'data-hide-damage': metrics.damage ? undefined : '',
		'data-hide-threat': metrics.threat ? undefined : '',
		'data-hide-healing': metrics.healing ? undefined : '',
		'data-hide-ep-ratios': metrics.epRatios ? undefined : '',
		'data-hide-experimental': metrics.experimental ? undefined : '',
	};
};
