import type { ActionId } from '../../../../proto_utils/action_id';

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
	actionId.setWowheadDataset(anchor, { useBuffAura: isAura }).catch(() => {});
	return anchor;
}
