import { addBulkItem, hasBulkItem, removeBulkItem } from '@features/bulk/model/items';
import { ItemSlot, ItemSpec } from '@generated/proto/common';
import { UIItem as Item } from '@generated/proto/ui';
import { useSimHost } from '@sim/context/SimHostContext';
import { isIndividualSimHost } from '@sim/sim_host';
import { Icon } from '@ui-kit/Icon';
import { useActionId } from '@ui-kit/hooks/useActionId';
import { itemQualityClassName } from '@ui-kit/utils/css';
import clsx from 'clsx';
import { type ReactNode, useMemo } from 'react';
import { useStore } from 'zustand';

import { trackEvent } from '../../../../tracking/analytics';
import type { ItemData, ItemListType } from '../../types';
import { SelectorModalTabs } from '../../types';
import { ItemNoticeIcon } from '../GearPicker/ItemNoticeIcon';
import { ItemCellAnchor, NameDescriptionLabel } from '../ItemCell';
import { ItemSource } from './ItemSource';

export interface ItemListRowProps {
	itemData: ItemData<ItemListType, ReactNode>;
	label: SelectorModalTabs;
	slot: ItemSlot;
	equippedEP: number | null;
	itemEP: number;
	favourited: boolean;
	favouriteTooltipId: string;
	compareTooltipId: string;
	onEquip: () => void;
	onToggleFavourite: () => void;
}

const formatDelta = (before: number, after: number): { text: string; tone: 'positive' | 'negative' | null } => {
	const delta = after - before;
	const text = delta >= 0 ? `+${delta.toFixed(0)}` : delta.toFixed(0);
	return { text, tone: delta === 0 ? null : delta > 0 ? 'positive' : 'negative' };
};

export const ItemListRow = ({
	itemData,
	label,
	slot,
	equippedEP,
	itemEP,
	favourited,
	favouriteTooltipId,
	compareTooltipId,
	onEquip,
	onToggleFavourite,
}: ItemListRowProps) => {
	const host = useSimHost();
	const { iconUrl, href } = useActionId(itemData.actionId);
	const showIlvl = label === SelectorModalTabs.Items || label === SelectorModalTabs.Upgrades;
	const showEp = ![ItemSlot.ItemSlotTrinket1, ItemSlot.ItemSlotTrinket2].includes(slot);
	const isItemsTab = label === SelectorModalTabs.Items;

	const batchPlayer = isIndividualSimHost(host) ? host.player : null;
	const batchSpec = useMemo(() => ItemSpec.create({ id: itemData.id }), [itemData.id]);
	// Read through zustand rather than `useStoreSubscribe`: the answer is keyed by a prop, and that
	// hook re-reads on a notification only, so a recycled row would keep the previous item's flag.
	const inBatch = useStore(host.sim.store, () => !!batchPlayer && hasBulkItem(batchPlayer, batchSpec));

	const delta = equippedEP !== null && equippedEP !== itemEP ? formatDelta(equippedEP, itemEP) : null;

	return (
		<>
			{showIlvl && <div className="selector-modal-list-item-ilvl-container">{itemData.ilvl || (itemData.item as unknown as Item).ilvl}</div>}
			<div className="selector-modal-list-label-cell gap-1">
				<ItemCellAnchor className="selector-modal-list-item-link" href={href || undefined} data-whtticon="false" onActivate={onEquip}>
					<img className="selector-modal-list-item-icon" src={iconUrl || undefined} alt="" />
					<span className={clsx('selector-modal-list-item-name', itemQualityClassName(itemData.quality))}>
						{itemData.name}
						{!!itemData.nameDescription && <NameDescriptionLabel nameDescription={itemData.nameDescription} />}
					</span>
				</ItemCellAnchor>
				<ItemNoticeIcon itemId={itemData.id} />
			</div>
			{isItemsTab && (
				<div className="selector-modal-list-item-source-container">
					<ItemSource item={itemData.item as unknown as Item} sim={host.sim} />
				</div>
			)}
			{showEp && (
				<div className="selector-modal-list-item-ep">
					<span className="selector-modal-list-item-ep-value">{itemEP < 9.95 ? itemEP.toFixed(1) : Math.round(itemEP).toString()}</span>
					<span className={clsx('selector-modal-list-item-ep-delta', delta?.tone)}>{delta?.text}</span>
				</div>
			)}
			<div className="selector-modal-list-item-favorite-container">
				<button
					type="button"
					className={clsx('selector-modal-list-item-favorite btn btn-link p-0', favourited && 'text-brand')}
					data-tooltip-id={favouriteTooltipId}
					data-favourited={String(favourited)}
					onClick={event => {
						event.stopPropagation();
						onToggleFavourite();
					}}>
					<Icon name="star" style={favourited ? 'solid' : 'regular'} size="xl" />
				</button>
			</div>
			{isItemsTab && (
				<div className="selector-modal-list-item-compare-container">
					<button
						type="button"
						className={clsx('selector-modal-list-item-compare btn btn-link p-0', inBatch && 'text-brand')}
						data-tooltip-id={compareTooltipId}
						data-in-batch={String(inBatch)}
						onClick={() => {
							const present = !!batchPlayer && hasBulkItem(batchPlayer, batchSpec);
							if (batchPlayer) (present ? removeBulkItem : addBulkItem)(batchPlayer, batchSpec);
							trackEvent({ action: 'click', category: 'batch', label: present ? 'remove-item' : 'add-item' });
						}}>
						<Icon name="arrow-right-arrow-left" size="xl" />
					</button>
				</div>
			)}
		</>
	);
};
