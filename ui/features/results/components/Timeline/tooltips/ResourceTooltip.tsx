import i18n from '@i18n/config';
import type { ResourceGroupLog, ResourceLog } from '@sim/proto/combat_log';
import { resourceNames } from '@sim/proto/names';
import { kebabCase } from '@sim/utils/format';
import { TIMELINE_SERIES_TEXT } from '@ui-kit/utils/colors';
import clsx from 'clsx';

import { percentageResources } from '../../../model/timeline/constants';
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
	const resourceName = resourceNames.get(log.resourceType)!;
	const seriesColorClass = TIMELINE_SERIES_TEXT[kebabCase(resourceName)];
	const asPercent = percentageResources.includes(log.resourceType);
	const display = (value: number) => (asPercent ? `${value.toFixed(1)} (${((value / maxValue) * 100).toFixed(0)}%)` : `${value.toFixed(1)}`);

	return (
		<div className={`ui-timeline-tooltip timeline-tooltip ${kebabCase(resourceName)}`}>
			<div className="ui-timeline-tooltip-header timeline-tooltip-header">
				<span className="font-bold">{log.timestamp.toFixed(2)}s</span>
			</div>
			<div className="ui-timeline-tooltip-body timeline-tooltip-body">
				<div className="ui-timeline-tooltip-body-row timeline-tooltip-body-row">
					<span className={clsx('series-color font-bold', seriesColorClass)}>
						{i18n.t('results_tab.details.timeline.tooltips.before')}: {display(log.valueBefore)}
					</span>
				</div>
				<ul className="timeline-mana-events">
					{log.logs.map((resourceLog, index) => (
						<TooltipLogItem key={index} log={resourceLog} seriesColorClass={seriesColorClass}>
							{delta(resourceLog)}
						</TooltipLogItem>
					))}
				</ul>
				<div className="ui-timeline-tooltip-body-row timeline-tooltip-body-row">
					<span className={clsx('series-color font-bold', seriesColorClass)}>
						{i18n.t('results_tab.details.timeline.tooltips.after')}: {display(log.valueAfter)}
					</span>
				</div>
			</div>
			{includeAuras && <TooltipAuras log={log} />}
		</div>
	);
};
