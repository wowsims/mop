// The gear-specific ActionId rendering. The generic writers moved to
// @ui-kit/action_id_dom (ui-kit may not import a feature, and the pickers use
// them); they are re-exported here so existing importers keep one entry point
// until the components/ split lands.
import type { Player } from '@domain/player';
import type { EquippedItem } from '@domain/proto_utils/equipped_item';
import { Profession } from '@generated/proto/common';
import { setActionIdWowheadDataset } from '@ui-kit/action_id_dom';

export {
	fillAndSetActionId,
	setActionIdBackground,
	setActionIdBackgroundAndHref,
	setActionIdWowheadDataset,
	setActionIdWowheadHref,
} from '@ui-kit/action_id_dom';

// Writes the full Wowhead tooltip dataset for one equipped item (gems, enchants,
// set pieces, upgrade step). Was Player.setWowheadData.
export async function setEquippedItemWowheadData(player: Player<any>, equippedItem: EquippedItem, elem: HTMLElement) {
	const isBlacksmithing = player.hasProfession(Profession.Blacksmithing);
	const gemIds = equippedItem.gems.length ? equippedItem.curGems(isBlacksmithing).map(gem => (gem ? gem.id : 0)) : [];
	const enchantIds = [equippedItem.enchant?.effectId, equippedItem.tinker?.effectId].filter((id): id is number => id !== undefined);
	setActionIdWowheadDataset(equippedItem.asActionId(), elem, {
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

	elem.dataset.whtticon = 'false';
}
