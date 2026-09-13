import type { ClassValue } from 'clsx';
import clsx from 'clsx';
import type { ReactNode } from 'react';

export interface ItemCellProps {
	icon: ReactNode;
	ilvl?: ReactNode;
	sockets?: ReactNode;
	name: ReactNode;
	labels?: ReactNode;
	action?: ReactNode;
	className?: ClassValue;
}

export const ItemCell = ({ icon, ilvl, sockets, name, labels, action, className }: ItemCellProps) => (
	<div className={clsx('item-picker-root ui-item-picker-root', className)}>
		<div className="item-picker-icon-wrapper ui-item-picker-icon-wrapper">
			{ilvl !== undefined && <span className="item-picker-ilvl ui-item-picker-ilvl">{ilvl}</span>}
			{icon}
			{sockets !== undefined && <div className="item-picker-sockets-container ui-item-picker-sockets-container">{sockets}</div>}
		</div>
		<div className="item-picker-labels-container ui-item-picker-labels-container">
			<div className="item-picker-name-row flex gap-1 tracking-normal">{name}</div>
			{labels}
		</div>
		{action}
	</div>
);
