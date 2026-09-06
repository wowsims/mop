import { Button } from '@ui-kit/Button';
import { Tooltip } from '@ui-kit/Tooltip';
import clsx from 'clsx';
import { type ReactNode, useId } from 'react';

export interface ToolbarItemProps {
	/**
	 * FontAwesome classes verbatim. Not `Icon`: these use the bare `fa` prefix as well as `fas`/`fab`,
	 * and `Icon` always emits a style class of its own, so routing them through it would change every
	 * glyph in the toolbar.
	 */
	icon?: string;
	tooltip?: ReactNode;
	/** Vanilla's `addToolbarLink` placed these below; the socials used tippy's default, which is top. */
	place?: 'top' | 'bottom';
	className?: string;
	href?: string;
	onClick?: () => void;
	hidden?: boolean;
	children?: ReactNode;
}

/**
 * One toolbar affordance: an `<a>` when it carries an href, a `<button>` otherwise — the split
 * `SimToolbarItem` made, and the reason the socials do not go through this component.
 */
export const ToolbarItem = ({ icon, tooltip, place = 'bottom', className, href, onClick, hidden, children }: ToolbarItemProps) => {
	const id = useId();
	const anchor = tooltip ? { 'data-tooltip-id': id } : {};
	const classes = clsx(className, hidden && 'hide');
	// An icon-only control announces nothing: the glyph is a private-use codepoint in a font, and the
	// tooltip is a `data-` attribute no assistive tech reads. The tooltip text is the name it already
	// has, so it becomes the name it exposes. Items that carry their own text keep it.
	const label = !children && typeof tooltip === 'string' ? tooltip : undefined;
	const content = (
		<>
			{icon && <i className={icon} aria-hidden="true" />}
			{children}
		</>
	);
	return (
		<div className="sim-toolbar-item">
			{/* `variant="unstyled"`: these carry their own classes, not `btn`. */}
			{href ? (
				<Button as="a" variant="unstyled" href={href} target="_blank" className={classes} aria-label={label} {...anchor}>
					{content}
				</Button>
			) : (
				<Button variant="unstyled" className={classes} aria-label={label} onClick={onClick} {...anchor}>
					{content}
				</Button>
			)}
			{tooltip && <Tooltip id={id} place={place} content={tooltip} />}
		</div>
	);
};
