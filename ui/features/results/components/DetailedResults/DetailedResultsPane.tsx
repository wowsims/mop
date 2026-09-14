import { TabPanel } from '@ui-kit/TabNav';
import type { ClassValue } from 'clsx';
import clsx from 'clsx';
import type { ReactNode } from 'react';

import { DpsHistogram } from '../DpsHistogram';
import { ToplineResults } from '../ToplineResults';

export interface DetailedResultsPaneProps {
	id: string;
	className?: ClassValue;
	contentClassName?: string;
	contentTestId?: string;
	topline?: boolean;
	histogram?: boolean;
	filling?: boolean;
	children?: ReactNode;
}

const rowClassName = (extra?: string) => clsx('ui-dr-row group-data-[no-results]/dr:hidden', extra);

export const DetailedResultsPane = ({ id, className, contentClassName, contentTestId, topline, histogram, filling, children }: DetailedResultsPaneProps) => (
	<TabPanel value={id} className={clsx('pt-0 pb-0', filling && 'ui-dr-filling-pane', className)}>
		{topline && (
			<div data-testid="dr-row" className={rowClassName('topline-results')}>
				<ToplineResults />
			</div>
		)}
		<div data-testid="dr-row" className={rowClassName()}>
			<div data-testid={contentTestId} className={contentClassName}>
				{children}
			</div>
		</div>
		{histogram && (
			<div data-testid="dr-row" className={rowClassName('dps-histogram')}>
				<DpsHistogram />
			</div>
		)}
	</TabPanel>
);
