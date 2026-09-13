import clsx from 'clsx';
import type { ReactNode } from 'react';

export interface SimTabPaneProps {
	id: string;
	className?: string;
	children: ReactNode;
}

export const SimTabPane = ({ id, className, children }: SimTabPaneProps) => (
	<div id={id} className={clsx('sim-tab', id, className)}>
		<div className="tab-pane-content-container">{children}</div>
	</div>
);
