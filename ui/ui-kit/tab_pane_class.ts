import type { TabsPanelState } from '@base-ui/react/tabs';
import type { ClassValue } from 'clsx';
import clsx from 'clsx';

/**
 * Produces Bootstrap's `tab-pane fade active show` classes, driven by the panel's own transition status.
 *
 * Base UI keeps the outgoing panel mounted for its fade-out. Reading `ending` as already-inactive
 * keeps two panes from ever being laid out at the same time.
 */
export const tabPaneClass = (state: TabsPanelState, ...extra: Array<ClassValue>) => {
	const active = !state.hidden && state.transitionStatus !== 'ending';
	return clsx('tab-pane fade', extra, active && 'active', active && state.transitionStatus !== 'starting' && 'show');
};
