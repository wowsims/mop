import type { ActionId } from '@sim/proto/action_id';
import { actionIdWowheadTooltipData } from '@sim/proto/action_id/dom';
import { externalRel } from '@sim/utils/links';
import { useActionId } from '@ui-kit/hooks/useActionId';
import { useWowheadDataset } from '@ui-kit/hooks/useWowheadDataset';
import { useMemo, useRef } from 'react';

export interface ActionLinkProps {
	actionId: ActionId;
	/** Resolves the tooltip against the buff aura rather than the spell — an aura line names the aura. */
	isAura?: boolean;
}

/**
 * The Wowhead tooltip this anchors is appended to `<body>` by Wowhead's own script, not rendered
 * here, so it is not a `position: fixed` descendant of the virtual list's transformed row.
 */
export const ActionLink = ({ actionId, isAura }: ActionLinkProps) => {
	const { iconUrl, name, href } = useActionId(actionId);
	const anchorRef = useRef<HTMLAnchorElement>(null);

	const resolveTooltip = useMemo(() => () => actionIdWowheadTooltipData(actionId, { useBuffAura: isAura }), [actionId, isAura]);
	useWowheadDataset(anchorRef, resolveTooltip);

	return (
		<a ref={anchorRef} className="log-action" target="_blank" href={href || undefined} rel={externalRel(href, undefined)}>
			<span>
				<span className="icon icon-sm" style={iconUrl ? { backgroundImage: `url('${iconUrl}')` } : undefined} /> {name}
			</span>
		</a>
	);
};
