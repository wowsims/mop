import { addBulkItem, hasBulkItem, removeBulkItem } from '@features/bulk/model/items';
import { ItemSlot, ItemSpec } from '@generated/proto/common';
import { UIItem as Item } from '@generated/proto/ui';
import { useSimHost } from '@sim/context/SimHostContext';
import { isIndividualSimHost } from '@sim/sim_host';
import { Button } from '@ui-kit/Button';
import { useActionId } from '@ui-kit/hooks/useActionId';
import { Icon } from '@ui-kit/Icon';
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
	active: boolean;
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
	active,
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
			{showIlvl && (
				<div className="w-12 text-center" data-testid="selector-modal-list-item-ilvl-container">
					{itemData.ilvl || (itemData.item as unknown as Item).ilvl}
				</div>
			)}
			<div className="gap-1 flex-1 flex items-center" data-testid="selector-modal-list-label-cell" data-active={active ? '' : undefined}>
				<ItemCellAnchor
					className="ui-selector-modal-list-item-link"
					data-testid="selector-modal-list-item-link"
					href={href || undefined}
					data-whtticon="false"
					onActivate={onEquip}>
					<img className="ui-selector-modal-list-item-icon" data-testid="selector-modal-list-item-icon" src={iconUrl || undefined} alt="" />
					<span
						className={clsx('ui-selector-modal-list-item-name', itemQualityClassName(itemData.quality))}
						data-testid="selector-modal-list-item-name">
						{itemData.name}
						{!!itemData.nameDescription && <NameDescriptionLabel nameDescription={itemData.nameDescription} />}
					</span>
				</ItemCellAnchor>
				<ItemNoticeIcon itemId={itemData.id} />
			</div>
			{isItemsTab && (
				<div className="w-64" data-testid="selector-modal-list-item-source-container">
					<ItemSource item={itemData.item as unknown as Item} sim={host.sim} />
				</div>
			)}
			{showEp && (
				<div className="w-24 flex items-center in-data-hide-ep:hidden" data-testid="selector-modal-list-item-ep">
					<span className="inline-block text-white text-right" data-testid="selector-modal-list-item-ep-value">
						{itemEP < 9.95 ? itemEP.toFixed(1) : Math.round(itemEP).toString()}
					</span>
					<span
						className={clsx('ml-1 text-ep-delta', delta?.tone)}
						data-testid="selector-modal-list-item-ep-delta"
						data-sign={delta?.tone ?? undefined}>
						{delta?.text}
					</span>
				</div>
			)}
			<div data-testid="selector-modal-list-item-favorite-container">
				<Button
					iconOnly
					aria-label="Favorite"
					className={clsx('relative z-1 w-8', favourited && 'text-brand')}
					data-testid="selector-modal-list-item-favorite"
					data-tooltip-id={favouriteTooltipId}
					data-favourited={String(favourited)}
					onClick={event => {
						event.stopPropagation();
						onToggleFavourite();
					}}>
					<Icon name="star" style={favourited ? 'solid' : 'regular'} size="xl" />
				</Button>
			</div>
			{isItemsTab && (
				<div data-testid="selector-modal-list-item-compare-container">
					<Button
						iconOnly
						aria-label="Compare"
						className={clsx('relative z-1 w-8', inBatch && 'text-brand')}
						data-testid="selector-modal-list-item-compare"
						data-tooltip-id={compareTooltipId}
						data-in-batch={String(inBatch)}
						onClick={() => {
							const present = !!batchPlayer && hasBulkItem(batchPlayer, batchSpec);
							if (batchPlayer) (present ? removeBulkItem : addBulkItem)(batchPlayer, batchSpec);
							trackEvent({ action: 'click', category: 'batch', label: present ? 'remove-item' : 'add-item' });
						}}>
						<Icon name="arrow-right-arrow-left" size="xl" />
					</Button>
				</div>
			)}
		</>
	);
};
