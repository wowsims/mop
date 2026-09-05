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
	className?: string;
}

// `clickOutsideAnchor` is tippy's `hideOnClick`. Escape is not an addition either: the app binds a
// global `keydown` that calls tippy's `hideAll()` (`shared/bootstrap_overrides.ts`), so every
// tooltip and popover in the tree closes on Escape today. Clicking inside the tooltip does not
// close it — the handler returns early on `tooltipRef.contains(target)`. Closing commits a
// half-typed edit rather than discarding it, as tippy does: React detaches the content in the
// mutation phase and flushes effect cleanups after, so a picker's native `change` listener is
// still attached when its input is removed. Measured — `tools/react-migration/sidebar-popover.mjs`.
const CLOSE_ON_CLICK_OUTSIDE = { clickOutsideAnchor: true, escape: true };

/**
 * Content is `children`, which react-tooltip does not render until the tooltip first opens — so a
 * picker built inside one costs nothing until it is shown, the way tippy's `onShow` hand-rolls it.
 *
 * The ref is the popover's `close()`: `character_stats.tsx` hides its bonus-stat popover from inside
 * the picker it contains, which is `instance.hide()` on the vanilla side.
 */
export const Tooltip = forwardRef<TooltipRefProps, TooltipProps>(function Tooltip({ id, content, place = 'top', clickable, openOnClick, className }, ref) {
	return (
		<ReactTooltip
			ref={ref}
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
});
