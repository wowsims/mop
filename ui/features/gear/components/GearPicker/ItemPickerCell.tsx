import type { ItemSlot } from '@generated/proto/common';
import { useSimHost } from '@sim/context/SimHostContext';
import { usePlayerStore } from '@sim/hooks/usePlayerStore';
import { useUiStore } from '@sim/hooks/useUiStore';
import { Tooltip } from '@ui-kit/Tooltip';
import { useCallback, useId } from 'react';

import { hasTouch } from '../../../../shared/pointer';
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

	const item = usePlayerStore('gear').getEquippedItem(slot);

	const showQuickSwapSetting = useUiStore('showQuickSwap');
	const showQuickSwap = !hasTouch() && showQuickSwapSetting;

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
					className="tooltip-quick-swap cursor-default"
					maxWidth="max-w-none"
					width="w-55"
					align="start"
					padded={false}
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
