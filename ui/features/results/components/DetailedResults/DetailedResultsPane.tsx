import type { ClassValue } from 'clsx';
import clsx from 'clsx';
import type { ReactNode } from 'react';

import { tabButtonId } from './utils';

export interface DetailedResultsPaneProps {
	id: string;
	className?: ClassValue;
	active: boolean;
	shown: boolean;
	children?: ReactNode;
}

export const DetailedResultsPane = ({ id, className, active, shown, children }: DetailedResultsPaneProps) => (
	<div
		id={id}
		className={clsx('tab-pane dr-tab-content fade', className, active && 'active', shown && 'show')}
		role="tabpanel"
		aria-labelledby={tabButtonId(id)}>
		{children}
	</div>
);
