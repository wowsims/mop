import { usePlayer } from '@domain/context/SimHostContext';
import { subscribePlayerField, subscribeSimField } from '@domain/state/subscriptions';
import { ItemSlot, Profession } from '@generated/proto/common';
import type { UIEnchant as Enchant } from '@generated/proto/ui';
import i18n from '@i18n/config';
import { useStoreSubscribe } from '@ui-kit/hooks/useStoreSubscribe';
import { useMemo } from 'react';

import { QuickSwapList } from './QuickSwapList';

export interface QuickEnchantListProps {
	slot: ItemSlot;
	onOpenDetail: () => void;
}

const isTinker = (enchant: Enchant) => enchant.requiredProfession === Profession.Engineering;

export const QuickEnchantList = ({ slot, onOpenDetail }: QuickEnchantListProps) => {
	const player = usePlayer();
	const gearSubscribe = useMemo(() => subscribePlayerField(player, 'gear'), [player]);
	const filtersSubscribe = useMemo(() => subscribeSimField(player.sim, 'filters'), [player]);
	const currentItem = useStoreSubscribe(gearSubscribe, () => player.getEquippedItem(slot));
	const favoriteEnchants = useStoreSubscribe(filtersSubscribe, () => player.sim.getFilters().favoriteEnchants);

	const entries = useMemo(() => {
		if (!currentItem) return [];
		const eligibleEnchants = player.getEnchants(slot).concat(player.getTinkers(slot));
		return favoriteEnchants
			.map(favoriteId => {
				const [enchantId, enchantType] = favoriteId.split('-').map(Number);
				return eligibleEnchants.find(enchant => enchant.effectId === enchantId && enchant.type === enchantType);
			})
			.filter((enchant): enchant is Enchant => !!enchant)
			.map(enchant => ({
				item: enchant,
				active: (isTinker(enchant) ? currentItem.tinker : currentItem.enchant)?.effectId === enchant.effectId,
			}));
	}, [player, slot, currentItem, favoriteEnchants]);

	return (
		<QuickSwapList
			title={i18n.t('gear_tab.gear_picker.quick_popovers.favorite_enchants.title')}
			emptyMessage={i18n.t('gear_tab.gear_picker.quick_popovers.favorite_enchants.empty_message')}
			entries={entries}
			onItemClick={clickedItem => {
				const equipped = player.getEquippedItem(slot);
				if (!equipped) return;
				player.equipItem(slot, isTinker(clickedItem) ? equipped.withTinker(clickedItem) : equipped.withEnchant(clickedItem));
			}}
			footerButton={{ label: i18n.t('gear_tab.gear_picker.quick_popovers.favorite_enchants.open_enchants'), onClick: onOpenDetail }}
		/>
	);
};
