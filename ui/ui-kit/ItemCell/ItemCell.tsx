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
	testId?: string;
	rootDataAttributes?: Record<string, string>;
}

export const ItemCell = ({ icon, ilvl, sockets, name, labels, action, className, testId, rootDataAttributes }: ItemCellProps) => (
	<div className={clsx('ui-item-picker-root', className)} data-testid={testId ?? 'item-picker-root'} {...rootDataAttributes}>
		<div className="ui-item-picker-icon-wrapper" data-testid="item-picker-icon-wrapper">
			{ilvl !== undefined && (
				<span className="ui-item-picker-ilvl" data-testid="item-picker-ilvl">
					{ilvl}
				</span>
			)}
			{icon}
			{sockets !== undefined && (
				<div className="ui-item-picker-sockets-container" data-testid="item-picker-sockets-container">
					{sockets}
				</div>
			)}
		</div>
		<div className="ui-item-picker-labels-container" data-testid="item-picker-labels-container">
			<div className="ui-item-picker-name-row flex gap-1 tracking-normal" data-testid="item-picker-name-row">
				{name}
			</div>
			{labels}
		</div>
		{action}
	</div>
);
