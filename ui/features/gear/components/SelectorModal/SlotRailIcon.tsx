import type { ItemSlot } from '@generated/proto/common';
import { translateSlotName } from '@i18n/localization';
import { usePlayer } from '@sim/context/SimHostContext';
import type { EquippedItem } from '@sim/proto/equipped_item';
import { useActionId } from '@ui-kit/hooks/useActionId';
import { useEquippedItemWowheadDataset } from '@ui-kit/hooks/useEquippedItemWowheadDataset';
import clsx from 'clsx';
import { useMemo } from 'react';

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
	const actionId = useMemo(() => item?.asActionId(), [item]);
	const { iconUrl, href } = useActionId(actionId);

	const wowheadProps = useEquippedItemWowheadDataset(player, item, isBlacksmithing);

	return (
		<div className={clsx('item-picker-icon-wrapper', active && 'active')} data-slot={slot}>
			<ItemCellAnchor
				className="item-picker-icon"
				role="button"
				href={href || undefined}
				onActivate={onOpen}
				data-whtticon="false"
				data-tooltip-id={tooltipId}
				data-slot-label={translateSlotName(slot) ?? ''}
				style={{ backgroundImage: `url('${(item && iconUrl) || getEmptySlotIconUrl(slot)}')` }}
				{...wowheadProps}
			/>
		</div>
	);
};
