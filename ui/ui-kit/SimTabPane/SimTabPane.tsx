import { TabPanelColumns } from '@ui-kit/TabPanelColumns';
import clsx from 'clsx';
import type { ReactNode } from 'react';

export interface SimTabPaneProps {
	id: string;
	className?: string;
	children: ReactNode;
}

export const SimTabPane = ({ id, className, children }: SimTabPaneProps) => (
	<div id={id} className={clsx('sim-tab', id, className)}>
		<TabPanelColumns.Root className="ui-tab-pane" data-testid="tab-pane-content-container">
			{children}
		</TabPanelColumns.Root>
	</div>
);
