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
		<div data-testid="metrics-action" className="flex items-center gap-2 whitespace-normal">
			<WowheadIcon
				testId="metrics-action-icon"
				className="mr-1 h-6 w-6 align-middle"
				label={name}
				href={href || undefined}
				iconUrl={iconUrl}
				actionId={actionId}
				useBuffAura={useBuffAura}
			/>
			<span data-testid="metrics-action-name" className="truncate">
				{name}
			</span>
			{expandable && (
				<Button
					variant="unstyled"
					data-testid="expand-toggle"
					className="ml-auto border-0 bg-transparent p-0 text-inherit focus-visible:focus-ring"
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
