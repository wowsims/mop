import type { PlayerSpec } from '@domain/player_spec';
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
		!metrics.damage && 'hide-damage-metrics',
		!metrics.threat && 'hide-threat-metrics',
		!metrics.healing && 'hide-healing-metrics',
		!metrics.epRatios && 'hide-ep-ratios',
		!metrics.experimental && 'hide-experimental',
	);

export interface SimUiClassesArgs {
	cssClass: string;
	spec: PlayerSpec<any>;
	metrics: MetricVisibility;
}

export const simUiClasses = ({ cssClass, spec, metrics }: SimUiClassesArgs): string =>
	clsx('sim-ui', 'individual-sim-ui', cssClass, simTypeClasses(spec), metricVisibilityClasses(metrics));
