import i18n from '@i18n/config';
import type { ThreatLogGroup } from '@sim/proto/combat_log';
import { TIMELINE_SERIES_TEXT } from '@ui-kit/utils/colors';
import clsx from 'clsx';

import { TooltipAuras } from '../tooltips/TooltipAuras';
import { TooltipLogItem } from '../tooltips/TooltipLogItem';

export interface ThreatTooltipProps {
	log: ThreatLogGroup;
}

export const ThreatTooltip = ({ log }: ThreatTooltipProps) => (
	<div className="ui-timeline-tooltip timeline-tooltip threat">
		<div className="ui-timeline-tooltip-header timeline-tooltip-header">
			<span className="font-bold">{log.timestamp.toFixed(2)}s</span>
		</div>
		<div className="ui-timeline-tooltip-body timeline-tooltip-body">
			<div className="ui-timeline-tooltip-body-row timeline-tooltip-body-row">
				<span className={clsx('series-color font-bold', TIMELINE_SERIES_TEXT.threat)}>
					{i18n.t('results_tab.details.timeline.tooltips.before')}: {log.threatBefore.toFixed(1)}
				</span>
			</div>
			<ul className="timeline-threat-events">
				{log.logs.map((threatLog, index) => (
					<TooltipLogItem key={index} log={threatLog} seriesColorClass={TIMELINE_SERIES_TEXT.threat}>
						{threatLog.threat.toFixed(1)} {i18n.t('results_tab.details.timeline.tooltips.threat')}
					</TooltipLogItem>
				))}
			</ul>
			<div className="ui-timeline-tooltip-body-row timeline-tooltip-body-row">
				<span className={clsx('series-color font-bold', TIMELINE_SERIES_TEXT.threat)}>
					{i18n.t('results_tab.details.timeline.tooltips.after')}: {log.threatAfter.toFixed(1)}
				</span>
			</div>
		</div>
		<TooltipAuras log={log} />
	</div>
);
