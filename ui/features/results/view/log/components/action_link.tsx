/** @jsxImportSource @jsx-vanilla */
import type { ActionId } from '@domain/proto_utils/action_id';
import { setActionIdBackground, setActionIdWowheadDataset, setActionIdWowheadHref } from '@domain/proto_utils/action_id/dom';

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
	setActionIdBackground(actionId, iconElem);
	setActionIdWowheadHref(actionId, anchor);
	setActionIdWowheadDataset(actionId, anchor, { useBuffAura: isAura });
	return anchor;
}
