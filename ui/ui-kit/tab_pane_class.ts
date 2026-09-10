import type { TabsPanelState } from '@base-ui/react/tabs';
import type { ClassValue } from 'clsx';
import clsx from 'clsx';

/**
 * Bootstrap's two-phase fade, driven by the panel's own transition status.
 *
 * Base UI keeps the outgoing panel mounted for its fade-out, where Bootstrap dropped `active` at once
 * and let `display: none` cut the transition. Reading `ending` as already-inactive keeps that, so two
 * panes are never laid out at the same time.
 */
export const tabPaneClass = (state: TabsPanelState, ...extra: Array<ClassValue>) => {
	const active = !state.hidden && state.transitionStatus !== 'ending';
	return clsx('tab-pane fade', extra, active && 'active', active && state.transitionStatus !== 'starting' && 'show');
};
