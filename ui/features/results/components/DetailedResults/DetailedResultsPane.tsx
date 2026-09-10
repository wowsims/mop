import { Tabs, type TabsPanelState } from '@base-ui/react/tabs';
import type { ClassValue } from 'clsx';
import clsx from 'clsx';
import type { ReactNode } from 'react';

import { DpsHistogram } from '../DpsHistogram';
import { ToplineResults } from '../ToplineResults';

export interface DetailedResultsPaneProps {
	id: string;
	className?: ClassValue;
	contentClassName: string;
	topline?: boolean;
	histogram?: boolean;
	children?: ReactNode;
}

// Base UI keeps the outgoing panel mounted for its own fade-out, where Bootstrap dropped `active` at
// once and let `display: none` cut the transition. Reading `ending` as already-inactive keeps that,
// so two panes are never laid out at the same time.
const paneClassName = (state: TabsPanelState, className: ClassValue) => {
	const active = !state.hidden && state.transitionStatus !== 'ending';
	return clsx('tab-pane dr-tab-content fade', className, active && 'active', active && state.transitionStatus !== 'starting' && 'show');
};

export const DetailedResultsPane = ({ id, className, contentClassName, topline, histogram, children }: DetailedResultsPaneProps) => (
	<Tabs.Panel value={id} id={id} keepMounted className={state => paneClassName(state, className)}>
		{topline && (
			<div className="dr-row topline-results">
				<ToplineResults />
			</div>
		)}
		<div className="dr-row">
			<div className={contentClassName}>{children}</div>
		</div>
		{histogram && (
			<div className="dr-row dps-histogram">
				<DpsHistogram />
			</div>
		)}
	</Tabs.Panel>
);
