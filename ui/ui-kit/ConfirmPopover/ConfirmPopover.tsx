import './ConfirmPopover.scss';

import i18n from '@i18n/config';
import { Button } from '@ui-kit/Button';
import type { PopoverProps } from '@ui-kit/Popover';
import { Popover } from '@ui-kit/Popover';
import type { ReactNode } from 'react';

export interface ConfirmPopoverProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	/** What the popover hangs off when the control that opens it is not its trigger. */
	anchor?: PopoverProps['anchor'];
	trigger?: ReactNode;
	triggerClassName?: PopoverProps['triggerClassName'];
	triggerProps?: PopoverProps['triggerProps'];
	container?: HTMLElement | null;
	side?: PopoverProps['side'];
	confirmLabel?: string;
	cancelLabel?: string;
	/** Omit for a message that is only acknowledged: one dismissing button, no cancel. */
	onConfirm?: () => void;
	children?: ReactNode;
}

export const ConfirmPopover = ({
	open,
	onOpenChange,
	anchor,
	trigger,
	triggerClassName,
	triggerProps,
	container,
	side = 'top',
	confirmLabel,
	cancelLabel,
	onConfirm,
	children,
}: ConfirmPopoverProps) => (
	<Popover
		open={open}
		onOpenChange={onOpenChange}
		anchor={anchor}
		trigger={trigger}
		triggerClassName={triggerClassName}
		triggerProps={triggerProps}
		container={container}
		side={side}
		className="sim-confirm-popover">
		<p className="sim-confirm-popover-message">{children}</p>
		<div className="sim-confirm-popover-actions">
			{onConfirm ? (
				<>
					<Button variant="outline-cancel" size="sm" onClick={() => onOpenChange(false)}>
						{cancelLabel ?? i18n.t('common.cancel')}
					</Button>
					<Button
						variant="cancel"
						size="sm"
						onClick={() => {
							onConfirm();
							onOpenChange(false);
						}}>
						{confirmLabel ?? i18n.t('common.confirm')}
					</Button>
				</>
			) : (
				<Button variant="primary" size="sm" onClick={() => onOpenChange(false)}>
					{confirmLabel ?? i18n.t('common.ok')}
				</Button>
			)}
		</div>
	</Popover>
);
