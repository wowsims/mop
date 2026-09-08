import i18n from '@i18n/config';
import type { ResourceGroupLog, ResourceLog } from '@sim/proto/combat_log';
import { resourceNames } from '@sim/proto/names';
import { kebabCase } from '@sim/utils/format';

import { percentageResources } from '../../../view/timeline/constants';
import { TooltipAuras } from './TooltipAuras';
import { TooltipLogItem } from './TooltipLogItem';

export interface ResourceTooltipProps {
	log: ResourceGroupLog;
	maxValue: number;
	includeAuras: boolean;
}

const delta = (log: ResourceLog): string => {
	const change = log.valueAfter - log.valueBefore;
	return change < 0 ? change.toFixed(1) : `+${change.toFixed(1)}`;
};

export const ResourceTooltip = ({ log, maxValue, includeAuras }: ResourceTooltipProps) => {
	// The class is the resource's own name, not `resourceClassName`'s `resource-` prefix: the
	// `.mana .series-color` rules colour the tooltip's numbers, not a resource swatch.
	const resourceName = resourceNames.get(log.resourceType)!;
	const asPercent = percentageResources.includes(log.resourceType);
	const display = (value: number) => (asPercent ? `${value.toFixed(1)} (${((value / maxValue) * 100).toFixed(0)}%)` : `${value.toFixed(1)}`);

	return (
		<div className={`timeline-tooltip ${kebabCase(resourceName)}`}>
			<div className="timeline-tooltip-header">
				<span className="bold">{log.timestamp.toFixed(2)}s</span>
			</div>
			<div className="timeline-tooltip-body">
				<div className="timeline-tooltip-body-row">
					<span className="series-color">
						{i18n.t('results_tab.details.timeline.tooltips.before')}: {display(log.valueBefore)}
					</span>
				</div>
				<ul className="timeline-mana-events">
					{log.logs.map((resourceLog, index) => (
						<TooltipLogItem key={index} log={resourceLog}>
							{delta(resourceLog)}
						</TooltipLogItem>
					))}
				</ul>
				<div className="timeline-tooltip-body-row">
					<span className="series-color">
						{i18n.t('results_tab.details.timeline.tooltips.after')}: {display(log.valueAfter)}
					</span>
				</div>
			</div>
			{includeAuras && <TooltipAuras log={log} />}
		</div>
	);
};
