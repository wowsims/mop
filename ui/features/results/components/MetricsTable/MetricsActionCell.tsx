import { externalRel } from '@sim/utils/links';
import type { ActionId } from '@sim/proto/action_id';
import { Button } from '@ui-kit/Button';
import { useActionId } from '@ui-kit/hooks/useActionId';
import { Icon } from '@ui-kit/Icon';
import { useActionIdWowheadDataset } from '@ui-kit/hooks/useActionIdWowheadDataset';

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
	const wowheadProps = useActionIdWowheadDataset(actionId, useBuffAura);

	return (
		<div className="metrics-action">
			<a
				className="metrics-action-icon"
				aria-label={name}
				href={href || undefined}
				rel={externalRel(href, undefined)}
				style={iconUrl ? { backgroundImage: `url('${iconUrl}')` } : undefined}
				{...wowheadProps}
			/>
			<span className="metrics-action-name text-truncate">{name}</span>
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
