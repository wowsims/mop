import { ItemDetailCell } from '@features/gear/components/ItemCell';
import { useOpenSelectorModal } from '@features/gear/hooks/useSelectorModal';
import type { SelectorModalTabs } from '@features/gear/types';
import { ItemSlot } from '@generated/proto/common';
import i18n from '@i18n/config';
import { BULK_SIM_ITEM_SLOT_TO_ITEM_SLOT_PAIRS, BulkSimItemSlot } from '@sim/bulk/utils';
import { usePlayer } from '@sim/context/SimHostContext';
import { useStoreSubscribe } from '@sim/hooks/useStoreSubscribe';
import type { EquippedItem } from '@sim/proto/equipped_item';
import { getEligibleItemSlots } from '@sim/proto/items';
import { subscribeAll, subscribeBulkChange, subscribePlayerField } from '@sim/state/subscriptions';
import { Tooltip, tooltipAnchorProps } from '@ui-kit/Tooltip';
import clsx from 'clsx';
import { useId, useMemo } from 'react';

import { useBulkTab } from '../../hooks/useBulkTab';
import { createBulkGearData } from '../../model/gear_data';
import { type BulkPickerGroup, frozenItemSlot } from '../../model/picker_groups';

export interface BulkItemPickerProps {
	group: BulkPickerGroup;
	/** Below zero for the two equipped slots the group covers; those report what is worn rather than offering a choice. */
	index: number;
	item: EquippedItem;
}

/** The physical slot an equipped entry stands for. Null for a user-added one. */
const equippedSlotOf = (bulkSlot: BulkSimItemSlot, index: number): ItemSlot | null => {
	if (index >= 0) return null;
	const slots = BULK_SIM_ITEM_SLOT_TO_ITEM_SLOT_PAIRS.get(bulkSlot);
	if (!slots) return null;
	return index === -1 ? slots[0] : slots[1];
};

export const BulkItemPicker = ({ group, index, item }: BulkItemPickerProps) => {
	const bt = useBulkTab();
	const openSelectorModal = useOpenSelectorModal();
	const player = usePlayer();
	const tooltipId = useId();
	const bulkSlot = group.bulkSlot;

	// One subscription over everything the cell's own state depends on: the frozen choices are the
	// tab's, and which entry counts as equipped is the player's gear.
	const state = useStoreSubscribe(
		useMemo(() => subscribeAll([subscribeBulkChange(bt), subscribePlayerField(player, 'gear')]), [bt, player]),
		() => {
			const gear = player.getGear();
			const ownSlot = equippedSlotOf(bulkSlot, index);
			const frozenBulkSlot = frozenItemSlot(gear, BULK_SIM_ITEM_SLOT_TO_ITEM_SLOT_PAIRS.get(bulkSlot), bt.frozenItems.get(bulkSlot));
			const isCurrentlyEquipped = bulkSlot !== BulkSimItemSlot.ItemSlotHandWeapon && player.getEquippedItems().some(equipped => equipped?.id === item.id);
			return {
				isEditable: index >= 0 && !isCurrentlyEquipped,
				isFrozen: !ownSlot
					? false
					: ownSlot === bt.frozenWeaponSlot
						? (gear.getEquippedItem(ownSlot)?.equals(item) ?? false)
						: ownSlot === frozenBulkSlot,
			};
		},
	);

	const slot = getEligibleItemSlots(item.item)[0];

	return (
		<ItemDetailCell
			slot={slot}
			item={item}
			className={clsx(
				'bulk-item-picker',
				state.isFrozen && 'bulk-item-picker-frozen',
				!state.isFrozen && !state.isEditable && 'bulk-item-picker-equipped',
			)}
			onOpen={(tab: SelectorModalTabs) => {
				if (!state.isEditable) return;
				openSelectorModal(slot, tab, createBulkGearData(bt, group, index));
			}}
			action={
				<div className="item-picker-actions-container">
					{index >= 0 && (
						<>
							<button
								type="button"
								className={clsx('btn btn-link link-danger item-picker-actions-btn', !state.isEditable && 'hide')}
								onClick={() => bt.removeItemByIndex(index)}
								{...tooltipAnchorProps(tooltipId)}>
								<i className="fas fa-times" />
							</button>
							<Tooltip id={tooltipId} content={i18n.t('bulk_tab.picker.remove_tooltip')} />
						</>
					)}
				</div>
			}
		/>
	);
};
