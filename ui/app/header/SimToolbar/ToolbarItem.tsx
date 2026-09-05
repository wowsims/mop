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
	const content = (
		<>
			{icon && <i className={icon} />}
			{children}
		</>
	);
	return (
		<div className="sim-toolbar-item">
			{href ? (
				<a href={href} target="_blank" className={classes} {...anchor}>
					{content}
				</a>
			) : (
				<button type="button" className={classes} onClick={onClick} {...anchor}>
					{content}
				</button>
			)}
			{tooltip && <Tooltip id={id} place={place} content={tooltip} />}
		</div>
	);
};
