import type { ItemSlot } from '@generated/proto/common';
import { translateSlotName } from '@i18n/localization';
import { usePlayer } from '@sim/context/SimHostContext';
import { equippedItemWowheadTooltipData } from '@sim/proto/action_id/dom';
import type { EquippedItem } from '@sim/proto/equipped_item';
import { useActionId } from '@ui-kit/hooks/useActionId';
import { useWowheadDataset } from '@ui-kit/hooks/useWowheadDataset';
import clsx from 'clsx';
import { useMemo, useRef } from 'react';

import { getEmptySlotIconUrl } from '../../model/empty_slot_icons';
import { ItemCellAnchor } from '../ItemCell';

export interface SlotRailIconProps {
	slot: ItemSlot;
	item: EquippedItem | null;
	isBlacksmithing: boolean;
	active: boolean;
	tooltipId: string;
	onOpen: () => void;
}

export const SlotRailIcon = ({ slot, item, isBlacksmithing, active, tooltipId, onOpen }: SlotRailIconProps) => {
	const player = usePlayer();
	const anchorRef = useRef<HTMLAnchorElement>(null);
	const actionId = useMemo(() => item?.asActionId(), [item]);
	const { iconUrl, href } = useActionId(actionId);

	const resolveTooltip = useMemo(() => (item ? () => equippedItemWowheadTooltipData(player, item, isBlacksmithing) : null), [player, item, isBlacksmithing]);
	useWowheadDataset([anchorRef], resolveTooltip);

	return (
		<div className={clsx('item-picker-icon-wrapper', active && 'active')} data-slot={slot}>
			<ItemCellAnchor
				ref={anchorRef}
				className="item-picker-icon"
				role="button"
				href={href || undefined}
				onActivate={onOpen}
				data-whtticon="false"
				data-tooltip-id={tooltipId}
				data-slot-label={translateSlotName(slot) ?? ''}
				style={{ backgroundImage: `url('${(item && iconUrl) || getEmptySlotIconUrl(slot)}')` }}
			/>
		</div>
	);
};
