import './Popover.scss';

import { Popover as BasePopover } from '@base-ui/react/popover';
import type { ClassValue } from 'clsx';
import clsx from 'clsx';
import type { ComponentPropsWithoutRef, ReactNode } from 'react';

export type PopoverSide = 'top' | 'right' | 'bottom' | 'left';
export type PopoverAlign = 'start' | 'center' | 'end';

export interface PopoverProps {
	/** Contents of the trigger button. `Popover.Root` renders no element of its own, so the trigger is the only element the popover puts in the page's flow. */
	trigger: ReactNode;
	triggerClassName?: ClassValue;
	/** Forwarded to the trigger `<button>`: `aria-label` for an icon-only trigger, and `tooltipAnchorProps(id)` for one that also carries a hover tooltip. */
	triggerProps?: Omit<ComponentPropsWithoutRef<'button'>, 'className' | 'children'>;
	/** Omit for an uncontrolled popover — the trigger drives it. `onOpenChange` fires either way. */
	open?: boolean;
	onOpenChange?: (open: boolean) => void;
	/** On the popup, which is the box a consumer sizes. */
	className?: ClassValue;
	/** Base UI's default is `<body>`, and that is outside `.sim-ui` — where the spec theme lives. See `Dialog`. */
	container?: HTMLElement | null;
	side?: PopoverSide;
	align?: PopoverAlign;
	sideOffset?: BasePopover.Positioner.Props['sideOffset'];
	openOnHover?: boolean;
	delay?: number;
	/** Base UI moves focus to the first tabbable element in the popup; `false` leaves it on the trigger, which is what tippy's `interactive: true` did. */
	initialFocus?: boolean;
	children?: ReactNode;
}

// tippy's default `offset` is `[0, 10]` and `ui/index.ts` overrides only `arrow` and `allowHTML`, so every anchored popup in the tree sits 10px off its anchor.
const TIPPY_DISTANCE = 10;

export const Popover = ({
	trigger,
	triggerClassName,
	triggerProps,
	open,
	onOpenChange,
	className,
	container,
	side = 'bottom',
	align = 'center',
	sideOffset = TIPPY_DISTANCE,
	openOnHover,
	delay,
	initialFocus = false,
	children,
}: PopoverProps) => (
	<BasePopover.Root open={open} modal={false} onOpenChange={nextOpen => onOpenChange?.(nextOpen)}>
		<BasePopover.Trigger className={clsx(triggerClassName)} openOnHover={openOnHover} delay={delay} {...triggerProps}>
			{trigger}
		</BasePopover.Trigger>
		{/* Named, because with a `container` the portal renders a wrapper element of its own. */}
		<BasePopover.Portal className="sim-popover-portal" container={container}>
			<BasePopover.Positioner className="sim-popover-positioner" side={side} align={align} sideOffset={sideOffset}>
				<BasePopover.Popup className={clsx('sim-popover-popup', className)} initialFocus={initialFocus}>
					{children}
				</BasePopover.Popup>
			</BasePopover.Positioner>
		</BasePopover.Portal>
	</BasePopover.Root>
);
