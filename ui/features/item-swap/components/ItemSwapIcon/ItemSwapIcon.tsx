import { GemSocket, ItemCellAnchor } from '@features/gear/components/ItemCell';
import { useOpenSelectorModal } from '@features/gear/hooks/useSelectorModal';
import { getEmptySlotIconUrl } from '@features/gear/model/empty_slot_icons';
import { SelectorModalTabs } from '@features/gear/types';
import type { ItemSlot } from '@generated/proto/common';
import { translateSlotName } from '@i18n/localization';
import { useSimHost } from '@sim/context/SimHostContext';
import { useIsBlacksmithing } from '@sim/hooks/useIsBlacksmithing';
import { useStoreSubscribe } from '@sim/hooks/useStoreSubscribe';
import { subscribePlayerField } from '@sim/state/subscriptions';
import { useActionId } from '@ui-kit/hooks/useActionId';
import { useEquippedItemWowheadDataset } from '@ui-kit/hooks/useEquippedItemWowheadDataset';
import clsx from 'clsx';
import { useMemo } from 'react';

import { createItemSwapGearData } from '../../model/gear_data';

export interface ItemSwapIconProps {
	slot: ItemSlot;
}

export const ItemSwapIcon = ({ slot }: ItemSwapIconProps) => {
	const host = useSimHost();
	const openSelectorModal = useOpenSelectorModal();
	const player = host.player;

	const swapSubscribe = subscribePlayerField(player, 'itemSwap');
	const item = useStoreSubscribe(swapSubscribe, () => player.itemSwapSettings.getItem(slot));

	const isBlacksmithing = useIsBlacksmithing();

	const actionId = useMemo(() => item?.asActionId(), [item]);
	const { iconUrl, name, href } = useActionId(actionId);

	const wowheadProps = useEquippedItemWowheadDataset(player, item, isBlacksmithing);

	return (
		<div className="icon-picker-root icon-picker">
			<ItemCellAnchor
				className={clsx('icon-picker-button', item && 'active')}
				role="button"
				aria-label={name || translateSlotName(slot) || undefined}
				href={href || undefined}
				data-whtticon={item ? 'false' : undefined}
				onActivate={() => openSelectorModal(slot, SelectorModalTabs.Items, createItemSwapGearData(player, slot))}
				style={{ backgroundImage: `url('${(item && iconUrl) || getEmptySlotIconUrl(slot)}')` }}
				{...wowheadProps}
			/>
			<div className="item-picker-sockets-container">
				{item?.allSocketColors().map((socketColor, gemIdx) => (
					<GemSocket
						key={gemIdx}
						socketColor={socketColor}
						gem={item.gems[gemIdx] ?? null}
						hidden={gemIdx === item.numPossibleSockets - 1 && item.couldHaveExtraSocket() && !isBlacksmithing}
					/>
				))}
			</div>
		</div>
	);
};
