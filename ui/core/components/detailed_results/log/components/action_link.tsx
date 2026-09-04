import type { ActionId } from '../../../../proto_utils/action_id';

// Only the wowhead dataset is worth memoising: it is the one part of an action link that costs
// a network round trip. Icon URL and href come straight off the already-resolved ActionId, so
// they are cheap to recompute per row instead of caching detached DOM (the old CacheHandler had
// no disposal hook).
const wowheadDatasetCache = new Map<string, string>();

export function ActionLink(actionId: ActionId, isAura?: boolean): HTMLAnchorElement {
	const iconElem = (<span className="icon icon-sm"></span>) as HTMLSpanElement;
	const anchor = (
		<a className="log-action" target="_blank">
			<span>
				{iconElem} {actionId.name}
			</span>
		</a>
	) as HTMLAnchorElement;
	// tsx-vanilla's `rel` prop only accepts one token; the DOM property takes the full string.
	anchor.rel = 'noopener noreferrer';
	actionId.setBackground(iconElem);
	actionId.setWowheadHref(anchor);

	const cacheKey = `${actionId.equalityKey()}|${isAura ? 1 : 0}`;
	const cachedDataset = wowheadDatasetCache.get(cacheKey);
	if (cachedDataset !== undefined) {
		anchor.dataset.wowhead = cachedDataset;
	} else {
		actionId
			.setWowheadDataset(anchor, { useBuffAura: isAura })
			.then(() => {
				if (anchor.dataset.wowhead) wowheadDatasetCache.set(cacheKey, anchor.dataset.wowhead);
			})
			.catch(() => {});
	}

	return anchor;
}
