import clsx from 'clsx';
import type { ReactNode } from 'react';

export interface ItemCellProps {
	icon: ReactNode;
	ilvl?: ReactNode;
	sockets?: ReactNode;
	name: ReactNode;
	labels?: ReactNode;
	action?: ReactNode;
	className?: string;
}

export const ItemCell = ({ icon, ilvl, sockets, name, labels, action, className }: ItemCellProps) => (
	<div className={clsx('item-picker-root', className)}>
		<div className="item-picker-icon-wrapper">
			{ilvl !== undefined && <span className="item-picker-ilvl">{ilvl}</span>}
			{icon}
			{sockets !== undefined && <div className="item-picker-sockets-container">{sockets}</div>}
		</div>
		<div className="item-picker-labels-container">
			<div className="item-picker-name-row d-flex gap-1">{name}</div>
			{labels}
		</div>
		{action}
	</div>
);
