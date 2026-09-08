import type { ActionId } from '@sim/proto/action_id';
import { actionIdWowheadTooltipData } from '@sim/proto/action_id/dom';
import { externalRel } from '@sim/utils/links';
import { useActionId } from '@ui-kit/hooks/useActionId';
import { useWowheadDataset } from '@ui-kit/hooks/useWowheadDataset';
import { useMemo, useRef } from 'react';

export interface RotationRowIconProps {
	actionId: ActionId;
	/** Absent for a section header, whose icon links out but carries no Wowhead tooltip. */
	tooltip?: 'spell' | 'buffAura';
}

export const RotationRowIcon = ({ actionId, tooltip }: RotationRowIconProps) => {
	const { iconUrl, href } = useActionId(actionId);
	const anchorRef = useRef<HTMLAnchorElement>(null);

	const resolveTooltip = useMemo(
		() => (tooltip ? () => actionIdWowheadTooltipData(actionId, { useBuffAura: tooltip === 'buffAura' }) : null),
		[actionId, tooltip],
	);
	useWowheadDataset(anchorRef, resolveTooltip);

	return (
		<a
			ref={anchorRef}
			className="rotation-row-icon"
			href={href || undefined}
			rel={externalRel(href, undefined)}
			style={iconUrl ? { backgroundImage: `url('${iconUrl}')` } : undefined}
		/>
	);
};
