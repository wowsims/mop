import type { PlayerSpec } from '@domain/player_spec';
import clsx from 'clsx';

/**
 * What the sidebar and the metrics columns key off — each flag hides when it is false.
 *
 * `epRatios` is a field rather than something derived here, because the shell subscribes it to a
 * different set of store fields than the healing class does — see `SimShell`.
 */
export interface MetricVisibility {
	damage: boolean;
	threat: boolean;
	healing: boolean;
	epRatios: boolean;
	experimental: boolean;
}

/** One of heal / tank / dps, and dps carries its range. Nothing is emitted for an unknown spec. */
export const simTypeClasses = (spec: PlayerSpec<any>): string =>
	clsx(
		spec.isHealingSpec && 'sim-type--heal',
		!spec.isHealingSpec && spec.isTankSpec && 'sim-type--tank',
		!spec.isHealingSpec && !spec.isTankSpec && (spec.isMeleeDpsSpec || spec.isRangedDpsSpec) && 'sim-type--dps',
		!spec.isHealingSpec && !spec.isTankSpec && spec.isMeleeDpsSpec && 'sim-type--melee',
		!spec.isHealingSpec && !spec.isTankSpec && !spec.isMeleeDpsSpec && spec.isRangedDpsSpec && 'sim-type--ranged',
	);

/**
 * EP ratios are a column *comparison*, so they only mean something when more than one column is on.
 * Threat metrics always show several, hence the first branch — the comment in the original called
 * the second case one that "doesn't currently happen", and it is kept because it costs nothing.
 */
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
	/** The spec's own class, e.g. `arms-warrior-sim-ui`. */
	cssClass: string;
	spec: PlayerSpec<any>;
	metrics: MetricVisibility;
}

/**
 * The whole class list for `.sim-ui`, in one place because it has to be: React writes `className`
 * wholesale, so an element cannot have part of its list from React and part from `classList` — the
 * next React render would drop the other half.
 */
export const simUiClasses = ({ cssClass, spec, metrics }: SimUiClassesArgs): string =>
	clsx('sim-ui', 'individual-sim-ui', cssClass, simTypeClasses(spec), metricVisibilityClasses(metrics));
