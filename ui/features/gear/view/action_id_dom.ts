// DOM writers for an ActionId — the icon background, the Wowhead href and the
// Wowhead tooltip dataset. These used to be methods on ActionId itself, which
// made a pure value object (ui/core/proto_utils/action_id.ts) depend on the
// DOM; ActionId is data now and the rendering lives here.
import type { Player } from '@core/player';
import { Profession } from '@core/proto/common';
import { ActionId } from '@core/proto_utils/action_id';
import type { EquippedItem } from '@core/proto_utils/equipped_item';
import type { WowheadTooltipItemParams, WowheadTooltipSpellParams } from '@core/wowhead';

export function setActionIdBackground(actionId: ActionId, elem: HTMLElement) {
	if (actionId.iconUrl) {
		elem.style.backgroundImage = `url('${actionId.iconUrl}')`;
	}
}

export function setActionIdWowheadHref(actionId: ActionId, elem: HTMLAnchorElement) {
	if (actionId.itemId) {
		elem.href = ActionId.makeItemUrl(actionId.itemId, actionId.randomSuffixId, actionId.reforgeId, actionId.upgradeStep);
	} else if (actionId.spellId) {
		elem.href = ActionId.makeSpellUrl(actionId.spellIdTooltipOverride || actionId.spellId);
	}
}

export async function setActionIdWowheadDataset(
	actionId: ActionId,
	elem: HTMLElement,
	params?: Omit<WowheadTooltipItemParams, 'itemId'> | Omit<WowheadTooltipSpellParams, 'spellId'>,
) {
	(actionId.itemId
		? ActionId.makeItemTooltipData(actionId.itemId, params)
		: ActionId.makeSpellTooltipData(actionId.spellIdTooltipOverride || actionId.spellId, params)
	).then(url => {
		if (elem) elem.dataset.wowhead = url;
	});
}

export function setActionIdBackgroundAndHref(actionId: ActionId, elem: HTMLAnchorElement) {
	setActionIdBackground(actionId, elem);
	setActionIdWowheadHref(actionId, elem);
}

export async function fillAndSetActionId(
	actionId: ActionId,
	elem: HTMLAnchorElement,
	setHref: boolean,
	setBackground: boolean,
	options: { signal?: AbortSignal } = {},
): Promise<ActionId> {
	const filled = await actionId.fill(undefined, options);
	if (setHref) {
		setActionIdWowheadHref(filled, elem);
	}
	if (setBackground) {
		setActionIdBackground(filled, elem);
	}
	return filled;
}

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
