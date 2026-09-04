import { Player } from '@domain/player';
import { EquippedItem } from '@domain/proto_utils/equipped_item';
import { ItemSlot, Profession } from '@generated/proto/common';
import { UIEnchant as Enchant } from '@generated/proto/ui';
import i18n from '@i18n/config';

import QuickSwapList from './quick_swap';

// Tinkers are stored as enchants and share the favorites list, but occupy their own item field.
const isTinker = (enchant: Enchant) => enchant.requiredProfession === Profession.Engineering;

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
			const eligibleEnchants = player.getEnchants(itemSlot).concat(player.getTinkers(itemSlot));
			const favoriteEnchants = player.sim.getFilters().favoriteEnchants;
			const eligibleFavoriteEnchants = favoriteEnchants
				?.map(favoriteId => {
					const [enchantId, enchantType] = favoriteId.split('-').map(Number);
					return eligibleEnchants.find(enchant => enchant.effectId === enchantId && enchant.type === enchantType);
				})
				.filter((enchant): enchant is Enchant => !!enchant);

			return eligibleFavoriteEnchants.map(enchant => ({
				item: enchant,
				active: (isTinker(enchant) ? currentItem.tinker : currentItem.enchant)?.effectId === enchant.effectId,
			}));
		},
		onItemClick: clickedItem => {
			// Read the equipped item at click time. The one captured when this popover was built
			// goes stale as soon as the slot changes, and writing it back would revert the item.
			const currentItem = player.getEquippedItem(itemSlot);
			if (!currentItem) return;
			player.equipItem(itemSlot, isTinker(clickedItem) ? currentItem.withTinker(clickedItem) : currentItem.withEnchant(clickedItem));
		},
		footerButton: {
			label: i18n.t('gear_tab.gear_picker.quick_popovers.favorite_enchants.open_enchants'),
			onClick: openDetailTab,
		},
	});
};
