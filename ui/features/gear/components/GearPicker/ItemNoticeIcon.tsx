import { Spec } from '@generated/proto/common';
import i18n from '@i18n/config';
import { usePlayer } from '@sim/context/SimHostContext';
import { Tooltip, tooltipAnchorProps } from '@ui-kit/Tooltip';
import { type ReactNode, useId } from 'react';

import { ITEM_NOTICES } from '../../item_notices';

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
		<div className="relative z-1 inline">
			<button
				type="button"
				aria-label={i18n.t('common.list_picker.warnings')}
				className="fa fa-exclamation-triangle fa-xl mr-2 text-damage-partial text-shadow-glow-danger"
				{...tooltipAnchorProps(tooltipId)}
			/>
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
