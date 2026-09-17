import { TabPanelColumns } from '@ui-kit/TabPanelColumns';
import clsx from 'clsx';
import type { ComponentPropsWithoutRef, ReactNode } from 'react';

export interface SimTabPaneProps extends Omit<ComponentPropsWithoutRef<'div'>, 'id' | 'className' | 'children'> {
	id: string;
	className?: string;
	children: ReactNode;
}

export const SimTabPane = ({ id, className, children, ...rest }: SimTabPaneProps) => (
	<div id={id} className={clsx(id, className)} data-testid="sim-tab" {...rest}>
		<TabPanelColumns.Root className="ui-tab-pane" data-testid="tab-pane-content-container">
			{children}
		</TabPanelColumns.Root>
	</div>
);
