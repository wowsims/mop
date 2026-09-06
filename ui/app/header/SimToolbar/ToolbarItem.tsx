import { Button } from '@ui-kit/Button';
import { Icon } from '@ui-kit/Icon';
import type { IconName, IconSize, IconStyle } from '@ui-kit/Icon/types';
import { Tooltip, tooltipAnchorProps } from '@ui-kit/Tooltip';
import clsx from 'clsx';
import { type ReactNode, useId } from 'react';

export interface ToolbarItemProps {
	icon?: IconName;
	iconStyle?: IconStyle;
	iconSize?: IconSize;
	tooltip?: ReactNode;
	place?: 'top' | 'bottom';
	className?: string;
	href?: string;
	onClick?: () => void;
	hidden?: boolean;
	children?: ReactNode;
}

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
	const anchor = tooltip ? tooltipAnchorProps(id) : {};
	const classes = clsx(className, hidden && 'hide');
	// An icon-only control announces nothing: the glyph is a private-use codepoint in a font, and the tooltip is a `data-` attribute no assistive tech reads.
	const label = !children && typeof tooltip === 'string' ? tooltip : undefined;
	const content = (
		<>
			{icon && <Icon name={icon} style={iconStyle} size={iconSize} />}
			{children}
		</>
	);
	return (
		<div className="sim-toolbar-item">
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
