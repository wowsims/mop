import { Button } from '@ui-kit/Button';
import { Icon } from '@ui-kit/Icon';
import type { IconName, IconSize, IconStyle } from '@ui-kit/Icon/types';
import { Tooltip } from '@ui-kit/Tooltip';
import clsx from 'clsx';
import { type ReactNode, useId } from 'react';

export interface ToolbarItemProps {
	icon?: IconName;
	/** Toolbar glyphs are `fas` unless told otherwise; `base` is the bare `fa` prefix. */
	iconStyle?: IconStyle;
	/** Every toolbar glyph is `fa-lg` today, so that is the default rather than a repeated prop. */
	iconSize?: IconSize;
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
export const ToolbarItem = ({
	icon,
	iconStyle = 'solid',
	iconSize = 'lg',
	tooltip,
	place = 'bottom',
	className,
	href,
	onClick,
	hidden,
	children,
}: ToolbarItemProps) => {
	const id = useId();
	const anchor = tooltip ? { 'data-tooltip-id': id } : {};
	const classes = clsx(className, hidden && 'hide');
	// An icon-only control announces nothing: the glyph is a private-use codepoint in a font, and the
	// tooltip is a `data-` attribute no assistive tech reads. The tooltip text is the name it already
	// has, so it becomes the name it exposes. Items that carry their own text keep it.
	const label = !children && typeof tooltip === 'string' ? tooltip : undefined;
	const content = (
		<>
			{icon && <Icon name={icon} style={iconStyle} size={iconSize} />}
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
