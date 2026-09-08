// DOM writers for an ActionId — the icon background, the Wowhead href and the
// Wowhead tooltip dataset. These used to be methods on ActionId itself, which
// made a pure value object (ui/sim/proto_utils/action_id.ts) depend on the
// DOM; ActionId is data now and the rendering lives here. They know nothing
// beyond ActionId, so they sit in ui-kit rather than in a feature.
import type { Player } from '../../player/player';
import type { EquippedItem } from '@sim/proto_utils/equipped_item';
import { Profession } from '@generated/proto/common';

import { setExternalAwareHref } from '../../utils/links';
import type { WowheadTooltipItemParams, WowheadTooltipSpellParams } from '../wowhead';
import { ActionId } from './index';

export function setActionIdBackground(actionId: ActionId, elem: HTMLElement) {
	if (actionId.iconUrl) {
		elem.style.backgroundImage = `url('${actionId.iconUrl}')`;
	}
}

export function setActionIdWowheadHref(actionId: ActionId, elem: HTMLAnchorElement) {
	if (actionId.itemId) {
		setExternalAwareHref(elem, ActionId.makeItemUrl(actionId.itemId, actionId.randomSuffixId, actionId.reforgeId, actionId.upgradeStep));
	} else if (actionId.spellId) {
		setExternalAwareHref(elem, ActionId.makeSpellUrl(actionId.spellIdTooltipOverride || actionId.spellId));
	}
}

export function actionIdWowheadTooltipData(
	actionId: ActionId,
	params?: Omit<WowheadTooltipItemParams, 'itemId'> | Omit<WowheadTooltipSpellParams, 'spellId'>,
): Promise<string> {
	return actionId.itemId
		? ActionId.makeItemTooltipData(actionId.itemId, params)
		: ActionId.makeSpellTooltipData(actionId.spellIdTooltipOverride || actionId.spellId, params);
}

// One dataset build feeds every element that shows the same tooltip.
function writeWowheadDataset(data: Promise<string>, elems: HTMLElement[]) {
	data.then(url => {
		elems.forEach(e => {
			if (e) e.dataset.wowhead = url;
		});
	});
}

// Fire-and-forget: the dataset lands once the tooltip data resolves. Deliberately NOT `async` —
// it used to be, and awaiting the call resolved before the write, which reads as a guarantee the
// function cannot give.
export function setActionIdWowheadDataset(
	actionId: ActionId,
	elem: HTMLElement | HTMLElement[],
	params?: Omit<WowheadTooltipItemParams, 'itemId'> | Omit<WowheadTooltipSpellParams, 'spellId'>,
) {
	writeWowheadDataset(actionIdWowheadTooltipData(actionId, params), Array.isArray(elem) ? elem : [elem]);
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
	const filled = await actionId.fill();
	if (options.signal?.aborted) {
		return filled;
	}
	if (setHref) {
		setActionIdWowheadHref(filled, elem);
	}
	if (setBackground) {
		setActionIdBackground(filled, elem);
	}
	return filled;
}

// Builds the full Wowhead tooltip dataset for one equipped item (gems, enchants,
// set pieces, upgrade step). Was Player.setWowheadData.
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

export function setEquippedItemWowheadData(player: Player<any>, equippedItem: EquippedItem, elem: HTMLElement | HTMLElement[]) {
	const elems = Array.isArray(elem) ? elem : [elem];
	writeWowheadDataset(equippedItemWowheadTooltipData(player, equippedItem, player.hasProfession(Profession.Blacksmithing)), elems);

	elems.forEach(e => (e.dataset.whtticon = 'false'));
}
