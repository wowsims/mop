import { Popover as BasePopover } from '@base-ui/react/popover';
import { usePortalContainer } from '@ui-kit/hooks/usePortalContainer';
import type { ClassValue } from 'clsx';
import clsx from 'clsx';
import type { ComponentPropsWithoutRef, ReactNode } from 'react';

export type PopoverSide = 'top' | 'right' | 'bottom' | 'left';
export type PopoverAlign = 'start' | 'center' | 'end';

export interface PopoverProps {
	/** Contents of the trigger button. `Popover.Root` renders no element of its own, so the trigger is the only element the popover puts in the page's flow. Omit it and give `anchor` instead, for a popover a control opens without becoming its trigger. */
	trigger?: ReactNode;
	/** What the popup is positioned against when there is no trigger. */
	anchor?: BasePopover.Positioner.Props['anchor'];
	triggerClassName?: ClassValue;
	triggerTestId?: string;
	/** Forwarded to the trigger `<button>`: `aria-label` for an icon-only trigger, and `tooltipAnchorProps(id)` for one that also carries a hover tooltip. */
	triggerProps?: Omit<ComponentPropsWithoutRef<'button'>, 'className' | 'children'>;
	/** Omit for an uncontrolled popover — the trigger drives it. `onOpenChange` fires either way. */
	open?: boolean;
	onOpenChange?: (open: boolean) => void;
	/** On the popup, which is the box a consumer sizes. */
	className?: ClassValue;
	maxWidth?: string;
	/** Base UI's default is `<body>`, and that is outside `.sim-ui` — where the spec theme lives. See `Dialog`. */
	container?: HTMLElement | null;
	side?: PopoverSide;
	align?: PopoverAlign;
	sideOffset?: BasePopover.Positioner.Props['sideOffset'];
	openOnHover?: boolean;
	delay?: number;
	/** Base UI moves focus to the first tabbable element in the popup; `false` leaves it on the trigger. */
	initialFocus?: boolean;
	children?: ReactNode;
	testId?: string;
}

// Every anchored popup in the tree sits 10px off its anchor.
const ANCHOR_DISTANCE = 10;

export const Popover = ({
	trigger,
	anchor,
	triggerClassName,
	triggerTestId,
	triggerProps,
	open,
	onOpenChange,
	className,
	maxWidth,
	container,
	side = 'bottom',
	align = 'center',
	sideOffset = ANCHOR_DISTANCE,
	openOnHover,
	delay,
	initialFocus = false,
	children,
	testId,
}: PopoverProps) => {
	const portalContainer = usePortalContainer();
	return (
		<BasePopover.Root open={open} modal={false} onOpenChange={nextOpen => onOpenChange?.(nextOpen)}>
			{trigger != null && (
				<BasePopover.Trigger className={clsx(triggerClassName)} data-testid={triggerTestId} openOnHover={openOnHover} delay={delay} {...triggerProps}>
					{trigger}
				</BasePopover.Trigger>
			)}
			{/* Named, because with a `container` the portal renders a wrapper element of its own. */}
			<BasePopover.Portal className="contents" data-testid="sim-popover-portal" container={container ?? portalContainer ?? undefined}>
				<BasePopover.Positioner
					className="ui-popover-positioner"
					data-testid="sim-popover-positioner"
					anchor={anchor}
					side={side}
					align={align}
					sideOffset={sideOffset}>
					<BasePopover.Popup
						className={clsx(maxWidth ?? 'max-w-(--available-width)', 'ui-popover', className)}
						data-testid={testId ?? 'sim-popover-popup'}
						initialFocus={initialFocus}>
						{children}
					</BasePopover.Popup>
				</BasePopover.Positioner>
			</BasePopover.Portal>
		</BasePopover.Root>
	);
};
