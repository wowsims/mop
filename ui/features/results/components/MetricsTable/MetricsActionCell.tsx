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
		<div className="metrics-action flex items-center gap-2 whitespace-normal">
			<WowheadIcon
				className="metrics-action-icon h-[24px] w-[24px] align-middle mr-[4px]"
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
					className="expand-toggle p-0 border-0 bg-transparent text-inherit ml-auto focus-visible:focus-ring"
					aria-expanded={expanded}
					aria-label={name}
					onClick={event => {
						event.stopPropagation();
						onToggle();
					}}>
					<Icon name={expanded ? 'caret-down' : 'caret-right'} style="base" />
				</Button>
			)}
		</div>
	);
};
