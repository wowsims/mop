import { TabPanel } from '@ui-kit/TabNav';
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

export const DetailedResultsPane = ({ id, className, contentClassName, topline, histogram, children }: DetailedResultsPaneProps) => (
	<TabPanel value={id} className={clsx('dr-tab-content', className)}>
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
	</TabPanel>
);
