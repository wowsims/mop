import type { Player } from '../../player/player';
import type { EquippedItem } from '../equipped_item';

import type { WowheadTooltipItemParams, WowheadTooltipSpellParams } from '../wowhead';
import { ActionId } from './index';

export function actionIdWowheadTooltipData(
	actionId: ActionId,
	params?: Omit<WowheadTooltipItemParams, 'itemId'> | Omit<WowheadTooltipSpellParams, 'spellId'>,
): Promise<string> {
	return actionId.itemId
		? ActionId.makeItemTooltipData(actionId.itemId, params)
		: ActionId.makeSpellTooltipData(actionId.spellIdTooltipOverride || actionId.spellId, params);
}

export function equippedItemWowheadTooltipData(player: Player<any>, equippedItem: EquippedItem, isBlacksmithing: boolean): Promise<string> {
	const gemIds = equippedItem.gems.length ? equippedItem.curGems(isBlacksmithing).map(gem => (gem ? gem.id : 0)) : [];
	const enchantIds = [equippedItem.enchant?.effectId, equippedItem.tinker?.effectId].filter((id): id is number => id !== undefined);
	return actionIdWowheadTooltipData(equippedItem.asActionId(), {
		gemIds,
		itemLevel: Number(equippedItem.ilvl),
		enchantIds: enchantIds,
		reforgeId: equippedItem.reforge?.id,
		randomEnchantmentId: equippedItem.randomSuffix?.id,
		setPieceIds: player
			.getGear()
			.asArray()
			.filter(ei => ei != null)
			.map(ei => ei!.item.id),
		hasExtraSocket: equippedItem.hasExtraSocket(isBlacksmithing),
		upgradeStep: equippedItem.upgrade,
	});
}
