import { Button } from '@ui-kit/Button';
import { Icon, type IconProps } from '@ui-kit/Icon';
import { Tooltip, tooltipAnchorProps, type TooltipPlace } from '@ui-kit/Tooltip';
import clsx from 'clsx';
import { type ReactNode, useId } from 'react';

export interface TooltipButtonProps {
	tooltip: ReactNode;
	/** The vanilla component hardcodes the question mark, which is why three of its six potential
	 * call sites hand-rolled the same button with a different glyph. */
	icon?: IconProps['name'];
	iconStyle?: IconProps['style'];
	place?: TooltipPlace;
	className?: string;
}

export const TooltipButton = ({ tooltip, icon = 'question-circle', iconStyle = 'regular', place, className }: TooltipButtonProps) => {
	const id = useId();
	return (
		<>
			<Button variant="link" className={clsx('tooltip-button', className)} {...tooltipAnchorProps(id)}>
				<Icon name={icon} style={iconStyle} />
			</Button>
			<Tooltip id={id} content={tooltip} place={place} />
		</>
	);
};
