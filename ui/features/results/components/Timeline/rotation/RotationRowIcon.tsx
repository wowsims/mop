import type { ActionId } from '@sim/proto/action_id';
import { externalRel } from '@sim/utils/links';
import { useActionId } from '@ui-kit/hooks/useActionId';
import { useActionIdWowheadDataset } from '@ui-kit/hooks/useActionIdWowheadDataset';

export interface RotationRowIconProps {
	actionId: ActionId;
	/** Absent for a section header, whose icon links out but carries no Wowhead tooltip. */
	tooltip?: 'spell' | 'buffAura';
}

export const RotationRowIcon = ({ actionId, tooltip }: RotationRowIconProps) => {
	const { iconUrl, href } = useActionId(actionId);
	const wowheadProps = useActionIdWowheadDataset(tooltip ? actionId : null, tooltip === 'buffAura');

	return (
		<a
			className="rotation-row-icon"
			href={href || undefined}
			rel={externalRel(href, undefined)}
			style={iconUrl ? { backgroundImage: `url('${iconUrl}')` } : undefined}
			{...wowheadProps}
		/>
	);
};
