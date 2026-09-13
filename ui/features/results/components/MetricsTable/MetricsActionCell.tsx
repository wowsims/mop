import type { ActionId } from '@sim/proto/action_id';
import { Button } from '@ui-kit/Button';
import { useActionId } from '@ui-kit/hooks/useActionId';
import { Icon } from '@ui-kit/Icon';
import { WowheadIcon } from '@ui-kit/WowheadIcon';

export interface MetricsActionCellProps {
	name: string;
	actionId: ActionId;
	useBuffAura?: boolean;
	expandable: boolean;
	expanded: boolean;
	onToggle: () => void;
}

export const MetricsActionCell = ({ name, actionId, useBuffAura, expandable, expanded, onToggle }: MetricsActionCellProps) => {
	const { iconUrl, href } = useActionId(actionId);

	return (
		<div className="metrics-action">
			<WowheadIcon
				className="metrics-action-icon"
				label={name}
				href={href || undefined}
				iconUrl={iconUrl}
				actionId={actionId}
				useBuffAura={useBuffAura}
			/>
			<span className="metrics-action-name truncate">{name}</span>
			{expandable && (
				<Button
					variant="unstyled"
					className="expand-toggle"
					aria-expanded={expanded}
					aria-label={name}
					onClick={event => {
						event.stopPropagation();
						onToggle();
					}}>
					<Icon name="caret-right" style="base" />
					<Icon name="caret-down" style="base" />
				</Button>
			)}
		</div>
	);
};
