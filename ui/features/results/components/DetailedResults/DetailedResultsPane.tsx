import { TabPanel } from '@ui-kit/TabNav';
import type { ClassValue } from 'clsx';
import clsx from 'clsx';
import type { ReactNode } from 'react';

import { DpsHistogram } from '../DpsHistogram';
import { ToplineResults } from '../ToplineResults';

export interface DetailedResultsPaneProps {
	id: string;
	className?: ClassValue;
	contentTestId?: string;
	topline?: boolean;
	histogram?: boolean;
	filling?: boolean;
	children?: ReactNode;
}

const rowClassName = 'ui-dr-row group-data-no-results/dr:hidden';

export const DetailedResultsPane = ({ id, className, contentTestId, topline, histogram, filling, children }: DetailedResultsPaneProps) => (
	<TabPanel value={id} className={clsx('pt-0 pb-0', filling && 'ui-dr-filling-pane', className)}>
		{topline && (
			<div data-testid="dr-row-topline" className={rowClassName}>
				<ToplineResults />
			</div>
		)}
		<div data-testid="dr-row" className={rowClassName}>
			<div data-testid={contentTestId}>{children}</div>
		</div>
		{histogram && (
			<div data-testid="dr-row-dps-histogram" className={rowClassName}>
				<DpsHistogram />
			</div>
		)}
	</TabPanel>
);
