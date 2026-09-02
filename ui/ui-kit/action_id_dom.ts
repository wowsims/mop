// DOM writers for an ActionId — the icon background, the Wowhead href and the
// Wowhead tooltip dataset. These used to be methods on ActionId itself, which
// made a pure value object (ui/domain/proto_utils/action_id.ts) depend on the
// DOM; ActionId is data now and the rendering lives here. They know nothing
// beyond ActionId, so they sit in ui-kit rather than in a feature.
import { ActionId } from '@domain/proto_utils/action_id';
import type { WowheadTooltipItemParams, WowheadTooltipSpellParams } from '@domain/wowhead';

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
