import { Button } from '@ui-kit/Button';
import { Icon } from '@ui-kit/Icon';
import type { IconName, IconSize, IconStyle } from '@ui-kit/Icon/types';
import { Tooltip, tooltipAnchorProps } from '@ui-kit/Tooltip';
import { type ReactNode, useId } from 'react';

export interface ToolbarItemProps {
	icon?: IconName;
	iconStyle?: IconStyle;
	iconSize?: IconSize;
	tooltip?: ReactNode;
	place?: 'top' | 'bottom';
	className?: string;
	testId?: string;
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
	testId,
	href,
	onClick,
	hidden,
	children,
}: ToolbarItemProps) => {
	const id = useId();
	const anchor = tooltip ? tooltipAnchorProps(id) : {};
	// An icon-only control announces nothing: the glyph is a private-use codepoint in a font, and the tooltip is a `data-` attribute no assistive tech reads.
	const label = !children && typeof tooltip === 'string' ? tooltip : undefined;
	const content = (
		<>
			{icon && <Icon name={icon} style={iconStyle} size={iconSize} />}
			{children}
		</>
	);
	return (
		<div className="ml-4 flex transition-colors duration-150 ease-in-out [&_a]:my-4 [&_button]:my-4" data-testid="sim-toolbar-item">
			{!hidden &&
				(href ? (
					<Button as="a" variant="unstyled" href={href} target="_blank" className={className} aria-label={label} data-testid={testId} {...anchor}>
						{content}
					</Button>
				) : (
					<Button variant="unstyled" className={className} aria-label={label} onClick={onClick} data-testid={testId} {...anchor}>
						{content}
					</Button>
				))}
			{tooltip && <Tooltip id={id} place={place} content={tooltip} />}
		</div>
	);
};
