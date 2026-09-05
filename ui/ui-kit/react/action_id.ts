import { ActionId } from '@domain/proto_utils/action_id';
import { useEffect, useRef, useState } from 'react';

export interface ActionIdState {
	iconUrl: string;
	name: string;
	/** The wowhead URL — known without filling; '' for an id carrying neither an item nor a spell. */
	href: string;
	/** False while the icon and name are still being fetched. */
	ready: boolean;
}

// reforgeId is in the wowhead item URL but is not part of equals(), so equalityKey() alone would
// hold a stale href across a reforge.
const keyOf = (actionId: ActionId) => `${actionId.equalityKey()}|${actionId.reforgeId}`;

const hrefOf = (actionId: ActionId) => {
	if (actionId.itemId) return ActionId.makeItemUrl(actionId.itemId, actionId.randomSuffixId, actionId.reforgeId, actionId.upgradeStep);
	if (actionId.spellId) return ActionId.makeSpellUrl(actionId.spellIdTooltipOverride || actionId.spellId);
	return '';
};

const stateOf = (actionId: ActionId): ActionIdState => ({
	iconUrl: actionId.iconUrl,
	name: actionId.name,
	href: hrefOf(actionId),
	ready: !!(actionId.name || actionId.iconUrl) || !actionId.anyId(),
});

/**
 * Resolves an `ActionId` to the fields a component renders: icon, name and wowhead href.
 *
 * The DOM writers in `action_id/dom.ts` are the vanilla equivalent, and `fillAndSetActionId` is
 * bypassed at nearly every call site because it fixes the markup — one anchor, a background image.
 * The data is the same everywhere and only the element differs, so this is a hook and each picker
 * renders its own element.
 *
 * An id that already carries a name or icon renders on the first pass; only an unfilled one waits
 * for a render. Changing the id aborts the fill in flight, so a slow first id cannot overwrite a
 * second one that resolved sooner.
 */
export function useActionId(actionId: ActionId): ActionIdState {
	const key = keyOf(actionId);
	const idRef = useRef(actionId);
	idRef.current = actionId;

	const [state, setState] = useState(() => stateOf(actionId));
	// Re-seeding during the render that changed the id, rather than in an effect, keeps the previous
	// id's icon from being painted under the new one's.
	const [seenKey, setSeenKey] = useState(key);
	if (seenKey !== key) {
		setSeenKey(key);
		setState(stateOf(actionId));
	}

	useEffect(() => {
		const id = idRef.current;
		if (stateOf(id).ready) return;

		const controller = new AbortController();
		id.fill(undefined, { signal: controller.signal }).then(
			filled => {
				if (!controller.signal.aborted) setState({ iconUrl: filled.iconUrl, name: filled.name, href: hrefOf(filled), ready: true });
			},
			() => {},
		);
		return () => controller.abort();
	}, [key]);

	return state;
}
