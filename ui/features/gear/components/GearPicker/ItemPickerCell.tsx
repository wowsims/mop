import type { ItemSlot } from '@generated/proto/common';
import { useSimHost } from '@sim/context/SimHostContext';
import { useStoreSubscribe } from '@sim/hooks/useStoreSubscribe';
import { subscribePlayerField, subscribeUiField } from '@sim/state/subscriptions';
import { Tooltip } from '@ui-kit/Tooltip';
import { useCallback, useId, useMemo } from 'react';

import { useOpenSelectorModal } from '../../hooks/useSelectorModal';
import { createGearData } from '../../model/gear_data';
import { SelectorModalTabs } from '../../types';
import { ItemDetailCell } from '../ItemCell';
import { QuickEnchantList } from './QuickEnchantList';
import { QuickGemList } from './QuickGemList';

export interface ItemPickerCellProps {
	slot: ItemSlot;
	ready: boolean;
}

export const ItemPickerCell = ({ slot, ready }: ItemPickerCellProps) => {
	const host = useSimHost();
	const openSelectorModal = useOpenSelectorModal();
	const player = host.player;
	const tooltipId = useId();

	const gearSubscribe = useMemo(() => subscribePlayerField(player, 'gear'), [player]);
	const gear = useStoreSubscribe(gearSubscribe, () => player.getGear());
	const item = gear.getEquippedItem(slot);

	const quickSwapSubscribe = useMemo(() => subscribeUiField(player.sim, 'showQuickSwap'), [player]);
	const showQuickSwap = useStoreSubscribe(quickSwapSubscribe, () => player.sim.getShowQuickSwap());

	const open = useCallback(
		(tab: SelectorModalTabs) => {
			if (!ready) return;
			openSelectorModal(slot, tab, createGearData(player, slot));
		},
		[openSelectorModal, player, slot, ready],
	);

	// The lists read the store inside `Tooltip`'s children, which react-tooltip does not build until
	// the tooltip first opens — that is what keeps 16-64 `filters` subscribers off the pane.
	const quickSwapTooltips =
		!item || !ready ? null : (
			<>
				<Tooltip
					id={`${tooltipId}-enchant`}
					className="tooltip-quick-swap"
					place="bottom"
					clickable
					hidden={!showQuickSwap}
					content={<QuickEnchantList slot={slot} onOpenDetail={() => open(SelectorModalTabs.Enchants)} />}
				/>
				{item.allSocketColors().map((_socketColor, gemIdx) => (
					<Tooltip
						key={gemIdx}
						id={`${tooltipId}-gem-${gemIdx}`}
						className="tooltip-quick-swap"
						place="bottom"
						clickable
						hidden={!showQuickSwap}
						content={<QuickGemList slot={slot} socketIdx={gemIdx} onOpenDetail={() => open(`Gem${gemIdx + 1}` as SelectorModalTabs)} />}
					/>
				))}
			</>
		);

	return (
		<ItemDetailCell
			slot={slot}
			item={item}
			onOpen={open}
			enchantTooltipId={`${tooltipId}-enchant`}
			socketTooltipId={gemIdx => `${tooltipId}-gem-${gemIdx}`}
			extraLabels={quickSwapTooltips}
		/>
	);
};
