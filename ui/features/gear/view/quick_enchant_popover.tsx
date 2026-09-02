import QuickSwapList from '@core/components/quick_swap';
import { ItemSlot } from '@core/proto/common';
import { UIEnchant as Enchant } from '@core/proto/ui';
import { Player } from '@domain/player';
import { EquippedItem } from '@domain/proto_utils/equipped_item';
import { nextEventID } from '@domain/state/batch';
import i18n from '@i18n/config';
export const addQuickEnchantPopover = (player: Player<any>, tooltipElement: HTMLElement, item: EquippedItem, itemSlot: ItemSlot, openDetailTab: () => void) => {
	return new QuickSwapList({
		title: i18n.t('gear_tab.gear_picker.quick_popovers.favorite_enchants.title'),
		emptyMessage: i18n.t('gear_tab.gear_picker.quick_popovers.favorite_enchants.empty_message'),
		tippyElement: tooltipElement,
		tippyConfig: {
			appendTo: document.querySelector('.sim-ui')!,
		},
		item,
		getItems: (currentItem: EquippedItem) => {
			const eligibleEnchants = player.sim.db.getEnchants(itemSlot);
			const favoriteEnchants = player.sim.getFilters().favoriteEnchants;
			const eligibleFavoriteEnchants = favoriteEnchants
				?.map(favoriteId => {
					const [enchantId, enchantType] = favoriteId.split('-').map(Number);
					return eligibleEnchants.find(enchant => enchant.effectId === enchantId && enchant.type === enchantType);
				})
				.filter((enchant): enchant is Enchant => !!enchant);

			return eligibleFavoriteEnchants.map(enchant => ({
				item: enchant,
				active: currentItem.enchant?.effectId === enchant.effectId,
			}));
		},
		onItemClick: clickedItem => {
			player.equipItem(nextEventID(), itemSlot, item.withEnchant(clickedItem));
		},
		footerButton: {
			label: i18n.t('gear_tab.gear_picker.quick_popovers.favorite_enchants.open_enchants'),
			onClick: openDetailTab,
		},
	});
};
