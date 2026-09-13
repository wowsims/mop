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
	container?: HTMLElement | null;
	className?: string;
	testId?: string;
	as?: ElementType;
	nameAs?: ElementType;
	rootProps?: Record<string, unknown>;
	nameProps?: Record<string, unknown>;
	deleteSlot?: ReactNode;
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
	container,
	className,
	testId = 'saved-data-set-chip',
	as: Root = 'div',
	nameAs: Name = 'button',
	rootProps,
	nameProps,
	deleteSlot,
}: ChipProps) => {
	const [confirming, setConfirming] = useState(false);

	return (
		<Root
			className={clsx(
				'saved-data-set-chip badge rounded-full flex p-0 border border-primary text-ui font-normal whitespace-nowrap text-center leading-none select-none cursor-pointer transition-[color,background-color,border-color,box-shadow] duration-150 ease-in-out data-[active]:bg-primary data-[active]:[&_.saved-data-set-name]:text-primary-foreground data-[active]:[&_.saved-data-set-delete]:text-primary-foreground hover:not-data-[active]:bg-primary-dampened data-[disabled]:hidden',
				active && 'active',
				disabled && 'disabled',
				className,
			)}
			data-testid={testId}
			data-active={active ? '' : undefined}
			data-disabled={disabled ? '' : undefined}
			{...rootProps}>
			<Name
				className="saved-data-set-name p-2 text-white"
				data-testid="saved-data-set-name"
				onClick={onSelect}
				{...(Name === 'button' ? { type: 'button' } : {})}
				{...tooltipAnchorProps(tooltip ? chipTooltipId : undefined, tooltip)}
				{...nameProps}>
				{label}
			</Name>
			{deleteSlot}
			{!deleteSlot && onDelete && (
				<ConfirmPopover
					open={confirming}
					onOpenChange={setConfirming}
					container={container}
					trigger={<Icon name="times" style="base" size="lg" />}
					triggerClassName="saved-data-set-delete py-2 pr-0 pl-0 mr-2 text-white"
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
