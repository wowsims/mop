import { type ReactNode, type RefObject, useLayoutEffect } from 'react';

export interface ListItemPopoverProps {
	popoverRef: RefObject<HTMLDivElement | null>;
	/** The button the popover is measured against — vanilla positioned off its rect. */
	anchorRef: RefObject<HTMLElement | null>;
	open: boolean;
	onClose: () => void;
	children?: ReactNode;
}

/**
 * The per-item action menu. It stays on the native popover API rather than moving to `Popover`,
 * because `.list-picker-item-popover:popover-open` is what `_list_picker.scss` styles and the
 * Base UI popup is a different element stack — this is a port, not a redesign.
 */
export const ListItemPopover = ({ popoverRef, anchorRef, open, onClose, children }: ListItemPopoverProps) => {
	useLayoutEffect(() => {
		const popover = popoverRef.current;
		const anchor = anchorRef.current;
		if (!popover) return;
		if (!open) {
			// `hidePopover` throws when the popover is not open; vanilla swallowed the same throw.
			try {
				popover.hidePopover();
			} catch {
				/* already hidden */
			}
			return;
		}
		try {
			popover.showPopover();
		} catch {
			/* no popover support, or already shown */
		}
		if (!anchor) return;
		const anchorRect = anchor.getBoundingClientRect();
		const popoverRect = popover.getBoundingClientRect();
		const diff = (popoverRect.height - anchorRect.height) / 2;
		popover.style.top = `${anchorRect.top - diff}px`;
		popover.style.left = `${anchorRect.right - popoverRect.width + 10}px`;
	}, [open, popoverRef, anchorRef]);

	return (
		<div ref={popoverRef} className={open ? 'list-picker-item-popover hover' : 'list-picker-item-popover'} popover="auto" onMouseLeave={onClose}>
			{children}
		</div>
	);
};
