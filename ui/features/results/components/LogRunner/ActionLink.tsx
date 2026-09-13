import type { ActionId } from '@sim/proto/action_id';
import { externalRel } from '@sim/utils/links';
import { useActionId } from '@ui-kit/hooks/useActionId';
import { useActionIdWowheadDataset } from '@ui-kit/hooks/useActionIdWowheadDataset';

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
	const wowheadProps = useActionIdWowheadDataset(actionId, isAura);

	return (
		<a className="log-action" target="_blank" href={href || undefined} rel={externalRel(href, undefined)} {...wowheadProps}>
			<span>
				<span className="icon icon-sm" style={iconUrl ? { backgroundImage: `url('${iconUrl}')` } : undefined} /> {name}
			</span>
		</a>
	);
};
