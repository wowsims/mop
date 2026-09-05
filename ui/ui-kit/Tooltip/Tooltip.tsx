import 'react-tooltip/dist/react-tooltip.css';
import './Tooltip.scss';

import clsx from 'clsx';
import type { ReactNode } from 'react';
import { Tooltip as ReactTooltip } from 'react-tooltip';

export type TooltipPlace = 'top' | 'right' | 'bottom' | 'left';

export interface TooltipProps {
	/** Anchors opt in with `data-tooltip-id={id}`; one Tooltip can serve many of them. */
	id: string;
	content?: ReactNode;
	place?: TooltipPlace;
	/** Lets the pointer enter the tooltip, for content with links or buttons in it. */
	clickable?: boolean;
	/** A popover: opens on click instead of hover, and closes on a click outside itself. */
	openOnClick?: boolean;
	className?: string;
}

// Matching tippy's `hideOnClick`, and deliberately nothing more. Escape would be a new close path
// with no blur in front of it, and react-tooltip unmounts the content on close — so it would drop a
// half-typed value out of an uncontrolled picker, which no path does today. Clicking inside the
// tooltip does not close it: the handler returns early on `tooltipRef.contains(target)`.
const CLOSE_ON_CLICK_OUTSIDE = { clickOutsideAnchor: true };

/**
 * Content is `children`, which react-tooltip does not render until the tooltip first opens — so a
 * picker built inside one costs nothing until it is shown, the way tippy's `onShow` hand-rolls it.
 */
export function Tooltip({ id, content, place = 'top', clickable, openOnClick, className }: TooltipProps) {
	return (
		<ReactTooltip
			id={id}
			place={place}
			clickable={clickable}
			openOnClick={openOnClick}
			globalCloseEvents={openOnClick ? CLOSE_ON_CLICK_OUTSIDE : undefined}
			className={clsx('sim-tooltip', className)}
			noArrow
			disableStyleInjection="core">
			{content}
		</ReactTooltip>
	);
}
