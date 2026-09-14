import type { ActionId } from '@sim/proto/action_id';
import { useActionId } from '@ui-kit/hooks/useActionId';
import { WowheadIcon } from '@ui-kit/WowheadIcon';

export interface RotationRowIconProps {
	actionId: ActionId;
	/** Absent for a section header, whose icon links out but carries no Wowhead tooltip. */
	tooltip?: 'spell' | 'buffAura';
}

export const RotationRowIcon = ({ actionId, tooltip }: RotationRowIconProps) => {
	const { iconUrl, href } = useActionId(actionId);

	return (
		<WowheadIcon
			testId="rotation-row-icon"
			className="ui-timeline-row-icon"
			href={href || undefined}
			iconUrl={iconUrl}
			actionId={tooltip ? actionId : null}
			useBuffAura={tooltip === 'buffAura'}
		/>
	);
};
