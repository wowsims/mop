import type { ActionId } from '@sim/proto/action_id';
import { externalRel } from '@sim/utils/links';
import { useActionId } from '@ui-kit/hooks/useActionId';
import { useActionIdWowheadDataset } from '@ui-kit/hooks/useActionIdWowheadDataset';
import { useRef } from 'react';

export interface ActionIdIconProps {
	actionId: ActionId;
	/** Aura sets show the buff's own tooltip rather than the spell that applies it. */
	useBuffAura: boolean;
}

/** The icon beside one spell or aura in an action-id menu. */
export const ActionIdIcon = ({ actionId, useBuffAura }: ActionIdIconProps) => {
	const anchorRef = useRef<HTMLAnchorElement>(null);
	const { iconUrl, href } = useActionId(actionId);
	useActionIdWowheadDataset(anchorRef, actionId, useBuffAura);

	return (
		<a
			ref={anchorRef}
			className="apl-actionid-item-icon"
			data-whtticon="false"
			href={href || undefined}
			rel={externalRel(href, undefined)}
			style={iconUrl ? { backgroundImage: `url('${iconUrl}')` } : undefined}
		/>
	);
};
