import { Popover } from '@ui-kit/Popover';
import type { ComponentPropsWithoutRef, ReactNode } from 'react';

export interface ListItemPopoverProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	children?: ReactNode;
}

const overlapTrigger = ({ anchor }: { anchor: { width: number } }) => -(anchor.width + 10);

export const ListItemPopover = ({ open, onOpenChange, children }: ListItemPopoverProps) => (
	<Popover
		trigger={<i className="fa fa-xl fa-ellipsis" />}
		triggerClassName="ui-list-picker-item-action"
		triggerProps={{ 'data-testid': 'list-picker-item-actions' } as ComponentPropsWithoutRef<'button'>}
		openOnHover
		delay={0}
		open={open}
		onOpenChange={onOpenChange}
		side="left"
		sideOffset={overlapTrigger}
		className="ui-list-picker-item-popover"
		testId="list-picker-item-popover">
		{children}
	</Popover>
);
