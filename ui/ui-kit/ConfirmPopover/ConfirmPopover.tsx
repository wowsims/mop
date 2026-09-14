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
	side?: PopoverProps['side'];
	confirmLabel?: string;
	cancelLabel?: string;
	/** Omit for a message that is only acknowledged: one dismissing button, no cancel. */
	onConfirm?: () => void;
	children?: ReactNode;
	testId?: string;
}

export const ConfirmPopover = ({
	open,
	onOpenChange,
	anchor,
	trigger,
	triggerClassName,
	triggerProps,
	side = 'top',
	confirmLabel,
	cancelLabel,
	onConfirm,
	children,
	testId,
}: ConfirmPopoverProps) => (
	<Popover
		open={open}
		onOpenChange={onOpenChange}
		anchor={anchor}
		trigger={trigger}
		triggerClassName={triggerClassName}
		triggerProps={triggerProps}
		side={side}
		testId={testId ?? 'sim-confirm-popover'}
		maxWidth="max-w-55">
		<p className="mb-3" data-testid="sim-confirm-popover-message">
			{children}
		</p>
		<div className="flex justify-end gap-2" data-testid="sim-confirm-popover-actions">
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
