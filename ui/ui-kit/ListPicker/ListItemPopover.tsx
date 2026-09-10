import { Popover } from '@ui-kit/Popover';
import type { ReactNode } from 'react';

export interface ListItemPopoverProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	container: HTMLElement | null;
	children?: ReactNode;
}

const overlapTrigger = ({ anchor }: { anchor: { width: number } }) => -(anchor.width + 10);

export const ListItemPopover = ({ open, onOpenChange, container, children }: ListItemPopoverProps) => (
	<Popover
		trigger={<i className="fa fa-xl fa-ellipsis" />}
		triggerClassName={['list-picker-item-action', 'list-picker-item-actions']}
		openOnHover
		delay={0}
		open={open}
		onOpenChange={onOpenChange}
		container={container}
		side="left"
		sideOffset={overlapTrigger}
		className="list-picker-item-popover">
		{children}
	</Popover>
);
