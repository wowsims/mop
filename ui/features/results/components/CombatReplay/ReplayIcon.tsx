import type { ActionId } from '@sim/proto/action_id';
import { actionIdWowheadTooltipData } from '@sim/proto/action_id/dom';
import { externalRel } from '@sim/utils/links';
import { useActionId } from '@ui-kit/hooks/useActionId';
import { useWowheadDataset } from '@ui-kit/hooks/useWowheadDataset';
import type { ClassValue } from 'clsx';
import clsx from 'clsx';
import type { CSSProperties, ReactNode, RefObject } from 'react';
import { useMemo, useRef } from 'react';

export interface ReplayIconProps {
	actionId: ActionId | null;
	className: ClassValue;
	tooltip: 'spell' | 'buffAura';
	style?: CSSProperties;
	/** Passed in by a caller that also paints the anchor every frame, so the two share one node. */
	anchorRef?: RefObject<HTMLAnchorElement | null>;
	children?: ReactNode;
}

/** The replay's one icon: the cast strip, the aura rows and the action grid are all this with a different class. */
export const ReplayIcon = ({ actionId, className, tooltip, style, anchorRef, children }: ReplayIconProps) => {
	const { iconUrl, href } = useActionId(actionId ?? undefined);
	const ownRef = useRef<HTMLAnchorElement>(null);
	const ref = anchorRef ?? ownRef;

	const resolveTooltip = useMemo(
		() => (actionId ? () => actionIdWowheadTooltipData(actionId, { useBuffAura: tooltip === 'buffAura' }) : null),
		[actionId, tooltip],
	);
	useWowheadDataset(ref, resolveTooltip);

	return (
		<a
			ref={ref}
			className={clsx(className)}
			href={href || undefined}
			rel={externalRel(href, undefined)}
			style={iconUrl ? { ...style, backgroundImage: `url('${iconUrl}')` } : style}>
			{children}
		</a>
	);
};
