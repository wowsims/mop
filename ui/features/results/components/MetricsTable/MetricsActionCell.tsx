import { externalRel } from '@sim/utils/links';
import type { ActionId } from '@sim/proto/action_id';
import { actionIdWowheadTooltipData } from '@sim/proto/action_id/dom';
import { Button } from '@ui-kit/Button';
import { useActionId } from '@ui-kit/hooks/useActionId';
import { useWowheadDataset } from '@ui-kit/hooks/useWowheadDataset';
import { Icon } from '@ui-kit/Icon';
import { useMemo, useRef } from 'react';

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
	const iconRef = useRef<HTMLAnchorElement>(null);

	const resolveTooltip = useMemo(() => () => actionIdWowheadTooltipData(actionId, { useBuffAura }), [actionId, useBuffAura]);
	useWowheadDataset(iconRef, resolveTooltip);

	return (
		<div className="metrics-action">
			<a
				ref={iconRef}
				className="metrics-action-icon"
				aria-label={name}
				href={href || undefined}
				rel={externalRel(href, undefined)}
				style={iconUrl ? { backgroundImage: `url('${iconUrl}')` } : undefined}
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
