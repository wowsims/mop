import { ConfirmPopover } from '@ui-kit/ConfirmPopover';
import { Icon } from '@ui-kit/Icon';
import { tooltipAnchorProps } from '@ui-kit/Tooltip';
import clsx from 'clsx';
import { type ComponentPropsWithoutRef, type ElementType, type ReactNode, useState } from 'react';

export interface ChipProps {
	label: ReactNode;
	active?: boolean;
	disabled?: boolean;
	onSelect?: () => void;
	onDelete?: () => void;
	deleteLabel?: string;
	deleteTooltipId?: string;
	chipTooltipId?: string;
	tooltip?: string;
	deleteMessage?: ReactNode;
	deleteConfirmLabel?: string;
	className?: string;
	testId?: string;
	as?: ElementType;
	nameAs?: ElementType;
	rootProps?: Record<string, unknown>;
	nameProps?: Record<string, unknown>;
	confirmDelete?: boolean;
}

export const Chip = ({
	label,
	active,
	disabled,
	onSelect,
	onDelete,
	deleteLabel,
	deleteTooltipId,
	chipTooltipId,
	tooltip,
	deleteMessage,
	deleteConfirmLabel,
	className,
	testId = 'saved-data-set-chip',
	as: Root = 'div',
	nameAs: Name = 'button',
	rootProps,
	nameProps,
	confirmDelete = true,
}: ChipProps) => {
	const [confirming, setConfirming] = useState(false);

	return (
		<Root
			className={clsx('ui-chip', 'data-active:[&_.ui-chip-name]:text-primary-foreground', className)}
			data-testid={testId}
			data-active={active ? '' : undefined}
			data-disabled={disabled ? '' : undefined}
			{...rootProps}>
			<Name
				className="ui-chip-name p-2 text-white"
				data-testid="saved-data-set-name"
				onClick={onSelect}
				{...(Name === 'button' ? { type: 'button' } : {})}
				{...tooltipAnchorProps(tooltip ? chipTooltipId : undefined, tooltip)}
				{...nameProps}>
				{label}
			</Name>
			{onDelete && !confirmDelete && (
				<button
					type="button"
					className="ui-chip-delete"
					data-testid="saved-data-set-delete"
					aria-label={deleteLabel}
					{...tooltipAnchorProps(deleteTooltipId)}
					onClick={onDelete}>
					<Icon name="times" style="base" size="lg" />
				</button>
			)}
			{onDelete && confirmDelete && (
				<ConfirmPopover
					open={confirming}
					onOpenChange={setConfirming}
					trigger={<Icon name="times" style="base" size="lg" />}
					triggerClassName="ui-chip-delete"
					triggerProps={
						{
							'aria-label': deleteLabel,
							'data-testid': 'saved-data-set-delete',
							...tooltipAnchorProps(deleteTooltipId),
						} as ComponentPropsWithoutRef<'button'>
					}
					confirmLabel={deleteConfirmLabel}
					onConfirm={onDelete}>
					{deleteMessage}
				</ConfirmPopover>
			)}
		</Root>
	);
};
