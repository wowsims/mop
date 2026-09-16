import type { ItemSlot } from '@generated/proto/common';
import i18n from '@i18n/config';
import { usePlayer } from '@sim/context/SimHostContext';
import { useIsBlacksmithing } from '@sim/hooks/useIsBlacksmithing';
import { usePlayerStore } from '@sim/hooks/usePlayerStore';
import { useSimStore } from '@sim/hooks/useSimStore';
import { useMemo } from 'react';

import { QuickSwapList } from './QuickSwapList';

export interface QuickGemListProps {
	slot: ItemSlot;
	socketIdx: number;
	onOpenDetail: () => void;
}

export const QuickGemList = ({ slot, socketIdx, onOpenDetail }: QuickGemListProps) => {
	const player = usePlayer();
	const currentItem = usePlayerStore('gear').getEquippedItem(slot);
	const favoriteGems = useSimStore('filters').favoriteGems;
	const isBlacksmithing = useIsBlacksmithing();

	const entries = useMemo(() => {
		if (!currentItem) return [];
		const socketColor = currentItem.curSocketColors(isBlacksmithing)[socketIdx];
		return player
			.getGems(socketColor)
			.filter(gem => favoriteGems.includes(gem.id))
			.sort((a, b) => (a.color > b.color ? 1 : -1))
			.map(gem => ({ item: gem, active: currentItem.gems[socketIdx]?.id === gem.id }));
	}, [player, socketIdx, currentItem, favoriteGems, isBlacksmithing]);

	return (
		<QuickSwapList
			title={i18n.t('gear_tab.gear_picker.quick_popovers.favorite_gems.title')}
			emptyMessage={i18n.t('gear_tab.gear_picker.quick_popovers.favorite_gems.empty_message')}
			entries={entries}
			onItemClick={clickedItem => {
				const equipped = player.getEquippedItem(slot);
				if (!equipped) return;
				player.equipItem(slot, equipped.withGem(clickedItem, socketIdx));
			}}
			footerButton={{ label: i18n.t('gear_tab.gear_picker.quick_popovers.favorite_gems.open_gems'), onClick: onOpenDetail }}
		/>
	);
};
