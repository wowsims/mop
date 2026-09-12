import { Tabs } from '@base-ui/react/tabs';
import { tabPaneClass } from '@ui-kit/tab_pane_class';
import type { ClassValue } from 'clsx';
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

export const DetailedResultsPane = ({ id, className, contentClassName, topline, histogram, children }: DetailedResultsPaneProps) => (
	<Tabs.Panel value={id} id={id} keepMounted className={state => tabPaneClass(state, 'dr-tab-content', className)}>
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
