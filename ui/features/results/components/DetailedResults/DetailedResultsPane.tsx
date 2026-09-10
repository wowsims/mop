import type { ClassValue } from 'clsx';
import clsx from 'clsx';
import type { ReactNode } from 'react';

import { DpsHistogram } from '../DpsHistogram';
import { ToplineResults } from '../ToplineResults';
import { tabButtonId } from './utils';

export interface DetailedResultsPaneProps {
	id: string;
	className?: ClassValue;
	contentClassName: string;
	active: boolean;
	shown: boolean;
	topline?: boolean;
	histogram?: boolean;
	children?: ReactNode;
}

export const DetailedResultsPane = ({ id, className, contentClassName, active, shown, topline, histogram, children }: DetailedResultsPaneProps) => (
	<div
		id={id}
		className={clsx('tab-pane dr-tab-content fade', className, active && 'active', shown && 'show')}
		role="tabpanel"
		aria-labelledby={tabButtonId(id)}>
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
	</div>
);
