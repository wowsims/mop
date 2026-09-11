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
import { bulkState } from '@sim/settings/bulk_settings';
import { subscribeAll, subscribeBulkChange, subscribePlayerField } from '@sim/state/subscriptions';
import { Tooltip, tooltipAnchorProps } from '@ui-kit/Tooltip';
import clsx from 'clsx';
import { useId } from 'react';

import { createBulkGearData } from '../../model/gear_data';
import { removeBulkItemByIndex } from '../../model/items';
import { frozenItemSlot } from '../../model/picker_groups';

export interface BulkItemPickerProps {
	bulkSlot: BulkSimItemSlot;
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

export const BulkItemPicker = ({ bulkSlot, index, item }: BulkItemPickerProps) => {
	const openSelectorModal = useOpenSelectorModal();
	const player = usePlayer();
	const tooltipId = useId();

	// One subscription over everything the cell's own state depends on: the frozen choices are the
	// tab's, and which entry counts as equipped is the player's gear.
	const state = useStoreSubscribe(subscribeAll([subscribeBulkChange(player), subscribePlayerField(player, 'gear')]), () => {
		const gear = player.getGear();
		const ownSlot = equippedSlotOf(bulkSlot, index);
		const frozenBulkSlot = frozenItemSlot(gear, BULK_SIM_ITEM_SLOT_TO_ITEM_SLOT_PAIRS.get(bulkSlot), bulkState(player).frozenItems.get(bulkSlot));
		const isCurrentlyEquipped = bulkSlot !== BulkSimItemSlot.ItemSlotHandWeapon && player.getEquippedItems().some(equipped => equipped?.id === item.id);
		return {
			isEditable: index >= 0 && !isCurrentlyEquipped,
			isFrozen: !ownSlot
				? false
				: ownSlot === bulkState(player).frozenWeaponSlot
					? (gear.getEquippedItem(ownSlot)?.equals(item) ?? false)
					: ownSlot === frozenBulkSlot,
		};
	});

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
				openSelectorModal(slot, tab, createBulkGearData(player, bulkSlot, index));
			}}
			action={
				<div className="item-picker-actions-container">
					{index >= 0 && (
						<>
							<button
								type="button"
								className={clsx('btn btn-link link-danger item-picker-actions-btn', !state.isEditable && 'hide')}
								onClick={() => removeBulkItemByIndex(player, index)}
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
