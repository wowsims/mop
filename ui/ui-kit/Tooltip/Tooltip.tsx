import 'react-tooltip/dist/react-tooltip.css';
import './Tooltip.scss';

import clsx from 'clsx';
import { forwardRef, type ReactNode } from 'react';
import { Tooltip as ReactTooltip, type TooltipRefProps } from 'react-tooltip';

export type TooltipPlace = 'top' | 'right' | 'bottom' | 'left';

export interface TooltipProps {
	/** Anchors opt in with `data-tooltip-id={id}`; one Tooltip can serve many of them. */
	id: string;
	content?: ReactNode;
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

// Both of these are tippy's defaults, which every call site in the tree inherits, and both apply to
// hover tooltips as much as to popovers:
//
// - `hideOnClick: true` hides on a click anywhere, the reference included. react-tooltip splits that
//   in two and defaults the anchor half off (`closeEvents.click`), so without `HOVER_CLOSE` the
//   bonus-stat icon's tooltip stayed open behind the popover its own button had just opened. A
//   screenshot diff against the vanilla build is what caught it; `sidebar-popover.mjs` counts open
//   tooltips now.
// - Escape: `shared/bootstrap_overrides.ts` binds a global `keydown` calling tippy's `hideAll()`,
//   which does not distinguish a hover tooltip from a popover.
//
// Clicking *inside* a tooltip does not close it — the handler returns early on
// `tooltipRef.contains(target)`. And closing commits a half-typed edit rather than discarding it,
// as tippy does: React detaches the content in the mutation phase and flushes effect cleanups
// after, so a picker's native `change` listener is still attached when its input is removed.
// Measured — `tools/react-migration/sidebar-popover.mjs`.
const GLOBAL_CLOSE = { clickOutsideAnchor: true, escape: true };
// Only for hover tooltips: `openOnClick` turns `mouseleave`/`blur` off, and passing this would
// turn them back on.
const HOVER_CLOSE = { mouseleave: true, blur: true, click: true };

/**
 * Content is `children`, which react-tooltip does not render until the tooltip first opens — so a
 * picker built inside one costs nothing until it is shown, the way tippy's `onShow` hand-rolls it.
 *
 * The ref is the popover's `close()`: `character_stats.tsx` hides its bonus-stat popover from inside
 * the picker it contains, which is `instance.hide()` on the vanilla side.
 */
export const Tooltip = forwardRef<TooltipRefProps, TooltipProps>(function Tooltip(
	{ id, content, place = 'top', clickable, openOnClick, hidden, onOpenChange, className },
	ref,
) {
	return (
		<ReactTooltip
			ref={ref}
			id={id}
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
});
