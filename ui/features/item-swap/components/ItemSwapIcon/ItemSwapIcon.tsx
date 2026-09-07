import { useSimHost } from '@sim/context/SimHostContext';
import { equippedItemWowheadTooltipData } from '@sim/proto_utils/action_id/dom';
import { subscribeAll, subscribePlayerField } from '@sim/state/subscriptions';
import { GemSocket, ItemCellAnchor } from '@features/gear/components/ItemCell';
import { SelectorModalTabs } from '@features/gear/types';
import { getEmptySlotIconUrl } from '@features/gear/view/gear_elements';
import type { ItemSlot } from '@generated/proto/common';
import { translateSlotName } from '@i18n/localization';
import { useActionId } from '@ui-kit/hooks/useActionId';
import { useStoreSubscribe } from '@ui-kit/hooks/useStoreSubscribe';
import { useWowheadDataset } from '@ui-kit/hooks/useWowheadDataset';
import clsx from 'clsx';
import { useMemo, useRef } from 'react';

import { createItemSwapGearData } from '../../model/gear_data';

export interface ItemSwapIconProps {
	slot: ItemSlot;
}

export const ItemSwapIcon = ({ slot }: ItemSwapIconProps) => {
	const host = useSimHost();
	const player = host.player;

	const swapSubscribe = useMemo(() => subscribePlayerField(player, 'itemSwap'), [player]);
	const item = useStoreSubscribe(swapSubscribe, () => player.itemSwapSettings.getItem(slot));

	const professionSubscribe = useMemo(
		() => subscribeAll([subscribePlayerField(player, 'profession1'), subscribePlayerField(player, 'profession2')]),
		[player],
	);
	const isBlacksmithing = useStoreSubscribe(professionSubscribe, () => player.isBlacksmithing());

	const actionId = useMemo(() => item?.asActionId(), [item]);
	const { iconUrl, name, href } = useActionId(actionId);

	const iconRef = useRef<HTMLAnchorElement>(null);
	const resolveTooltip = useMemo(() => (item ? () => equippedItemWowheadTooltipData(player, item, isBlacksmithing) : null), [player, item, isBlacksmithing]);
	useWowheadDataset(iconRef, resolveTooltip);

	return (
		<div className="icon-picker-root icon-picker">
			<ItemCellAnchor
				ref={iconRef}
				className={clsx('icon-picker-button', item && 'active')}
				role="button"
				aria-label={name || translateSlotName(slot) || undefined}
				href={href || undefined}
				data-whtticon={item ? 'false' : undefined}
				onActivate={() => host.itemSwapSelectorModal?.openTab(slot, SelectorModalTabs.Items, createItemSwapGearData(player, slot))}
				style={{ backgroundImage: `url('${(item && iconUrl) || getEmptySlotIconUrl(slot)}')` }}
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
