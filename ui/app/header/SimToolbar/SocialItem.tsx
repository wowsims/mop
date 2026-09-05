import { Tooltip } from '@ui-kit/Tooltip';
import { type ReactNode, useId } from 'react';

export interface SocialItemProps {
	href: string;
	className: string;
	icon: string;
	tooltip: string;
	children?: ReactNode;
}

/**
 * A social link. Separate from `ToolbarItem` because it is the one item vanilla did not build with
 * `SimToolbarItem`'s href branch: `SocialLinks` passed a finished anchor as a *child*, and with no
 * `href` of its own the item wrapped it in a `<button>`. `div.sim-toolbar-item > button > a` is not
 * valid — `<button>`'s content model has no room for interactive descendants — so the wrapper is
 * gone here and the anchor is the item's own child. `parity.mjs` collapses it on the vanilla side.
 *
 * Layout is unaffected: the margins come from `.sim-toolbar-socials { a, button { … } }`, which the
 * anchor matches either way, and it becomes the flex item the button used to be.
 */
export const SocialItem = ({ href, className, icon, tooltip, children }: SocialItemProps) => {
	const id = useId();
	return (
		<div className="sim-toolbar-item">
			{/* The tooltip is the accessible name — Patreon's visible " Patreon" is inside it, so the
			    name still contains the label. */}
			<a href={href} target="_blank" rel="noopener noreferrer" className={className} aria-label={tooltip} data-tooltip-id={id}>
				<i className={icon} aria-hidden="true" />
				{children}
			</a>
			{/* tippy's default placement, which the socials took and the rest of the toolbar did not. */}
			<Tooltip id={id} content={tooltip} />
		</div>
	);
};
