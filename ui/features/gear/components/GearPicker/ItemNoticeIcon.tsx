import { Spec } from '@generated/proto/common';
import { usePlayer } from '@sim/context/SimHostContext';
import { Tooltip, tooltipAnchorProps } from '@ui-kit/Tooltip';
import { type ReactNode, useId } from 'react';

import { ITEM_NOTICES } from './item_notices';

export interface ItemNoticeIconProps {
	itemId: number;
	additionalNotice?: ReactNode;
}

export const ItemNoticeIcon = ({ itemId, additionalNotice }: ItemNoticeIconProps) => {
	const player = usePlayer();
	const tooltipId = useId();
	const spec = player.getSpec();

	const itemNotice = ITEM_NOTICES.get(itemId);
	const ownNotice = itemNotice?.[spec] || itemNotice?.[Spec.SpecUnknown];

	if (!ownNotice && !additionalNotice) return null;

	return (
		<div className="item-notice d-inline">
			<button type="button" className="warning fa fa-exclamation-triangle fa-xl me-2" {...tooltipAnchorProps(tooltipId)} />
			<Tooltip
				id={tooltipId}
				content={
					<div>
						{ownNotice}
						{additionalNotice}
					</div>
				}
				clickable
			/>
		</div>
	);
};
