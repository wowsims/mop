import 'react-tooltip/dist/react-tooltip.css';
import './Tooltip.scss';

import clsx from 'clsx';
import type { ReactNode } from 'react';
import { Tooltip as ReactTooltip } from 'react-tooltip';

export type TooltipPlace = 'top' | 'right' | 'bottom' | 'left';

export interface TooltipProps {
	/** Anchors opt in with `data-tooltip-id={id}`; one Tooltip can serve many of them. */
	id: string;
	content?: ReactNode;
	place?: TooltipPlace;
	/** Lets the pointer enter the tooltip, for content with links or buttons in it. */
	clickable?: boolean;
	className?: string;
}

export function Tooltip({ id, content, place = 'top', clickable, className }: TooltipProps) {
	return (
		<ReactTooltip id={id} place={place} clickable={clickable} className={clsx('sim-tooltip', className)} noArrow disableStyleInjection="core">
			{content}
		</ReactTooltip>
	);
}
