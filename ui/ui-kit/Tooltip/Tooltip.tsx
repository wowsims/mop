import 'react-tooltip/dist/react-tooltip.css';
import './Tooltip.scss';

import clsx from 'clsx';
import { forwardRef, type ReactNode } from 'react';
import { type ITooltip, Tooltip as ReactTooltip, type TooltipRefProps } from 'react-tooltip';

export type TooltipPlace = 'top' | 'right' | 'bottom' | 'left';

export interface TooltipProps {
	/** Anchors opt in with `data-tooltip-id={id}`; one Tooltip can serve many of them. */
	id: string;
	content?: ReactNode;
	/** Per-anchor content, for one Tooltip serving a whole column: read the row off `activeAnchor`. Returning nothing renders no tooltip at all. */
	render?: ITooltip['render'];
	place?: TooltipPlace;
	/** Lets the pointer enter the tooltip, for content with links or buttons in it. */
	clickable?: boolean;
	/** A popover: opens on click instead of hover, and closes on a click outside itself or Escape. */
	openOnClick?: boolean;
	/** Unmounts the tooltip. Use it to suppress one while a popover on the same control is open. */
	hidden?: boolean;
	/** Fires after the open and close transitions, not at the request — see `BonusStatsLink`. */
	onOpenChange?: (open: boolean) => void;
	className?: string;
}

// react-tooltip splits click-close into an anchor half and a global half, and defaults the anchor half off (`closeEvents.click`), so without `HOVER_CLOSE` the bonus-stat icon's tooltip stayed open behind the popover its own button had just opened.
const GLOBAL_CLOSE = { clickOutsideAnchor: true, escape: true };
// `openEvents` is deliberately never passed.
const HOVER_CLOSE = { mouseleave: true, blur: true, click: true };

/** Content is `children`, which react-tooltip does not render until the tooltip first opens — so a picker built inside one costs nothing until it is shown. */
export const Tooltip = forwardRef<TooltipRefProps, TooltipProps>(
	({ id, content, render, place = 'top', clickable, openOnClick, hidden, onOpenChange, className }, ref) => {
		return (
			<ReactTooltip
				ref={ref}
				id={id}
				render={render}
				place={place}
				clickable={clickable}
				openOnClick={openOnClick}
				closeEvents={openOnClick ? undefined : HOVER_CLOSE}
				globalCloseEvents={GLOBAL_CLOSE}
				hidden={hidden}
				afterShow={onOpenChange && (() => onOpenChange(true))}
				afterHide={onOpenChange && (() => onOpenChange(false))}
				className={clsx('sim-tooltip', className)}
				noArrow
				disableStyleInjection="core">
				{content}
			</ReactTooltip>
		);
	},
);
Tooltip.displayName = 'Tooltip';
