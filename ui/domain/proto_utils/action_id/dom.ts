// DOM writers for an ActionId — the icon background, the Wowhead href and the
// Wowhead tooltip dataset. These used to be methods on ActionId itself, which
// made a pure value object (ui/domain/proto_utils/action_id.ts) depend on the
// DOM; ActionId is data now and the rendering lives here. They know nothing
// beyond ActionId, so they sit in ui-kit rather than in a feature.
import type { Player } from '@domain/player';
import type { EquippedItem } from '@domain/proto_utils/equipped_item';
import { Profession } from '@generated/proto/common';

import { setExternalAwareHref } from '../../links';
import type { WowheadTooltipItemParams, WowheadTooltipSpellParams } from '../../wowhead';
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

// Fire-and-forget: the dataset lands once the tooltip data resolves. Deliberately NOT `async` —
// it used to be, and awaiting the call resolved before the write, which reads as a guarantee the
// function cannot give.
export function setActionIdWowheadDataset(
	actionId: ActionId,
	elem: HTMLElement | HTMLElement[],
	params?: Omit<WowheadTooltipItemParams, 'itemId'> | Omit<WowheadTooltipSpellParams, 'spellId'>,
) {
	// One dataset build feeds every element that shows the same tooltip.
	(actionId.itemId
		? ActionId.makeItemTooltipData(actionId.itemId, params)
		: ActionId.makeSpellTooltipData(actionId.spellIdTooltipOverride || actionId.spellId, params)
	).then(url => {
		(Array.isArray(elem) ? elem : [elem]).forEach(e => {
			if (e) e.dataset.wowhead = url;
		});
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
export function setEquippedItemWowheadData(player: Player<any>, equippedItem: EquippedItem, elem: HTMLElement | HTMLElement[]) {
	const isBlacksmithing = player.hasProfession(Profession.Blacksmithing);
	const gemIds = equippedItem.gems.length ? equippedItem.curGems(isBlacksmithing).map(gem => (gem ? gem.id : 0)) : [];
	const enchantIds = [equippedItem.enchant?.effectId, equippedItem.tinker?.effectId].filter((id): id is number => id !== undefined);
	const elems = Array.isArray(elem) ? elem : [elem];
	setActionIdWowheadDataset(equippedItem.asActionId(), elems, {
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

	elems.forEach(e => (e.dataset.whtticon = 'false'));
}
