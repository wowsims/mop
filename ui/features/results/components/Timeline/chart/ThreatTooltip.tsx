import i18n from '@i18n/config';
import type { ThreatLogGroup } from '@sim/proto/combat_log';

import { TooltipAuras } from '../tooltips/TooltipAuras';
import { TooltipLogItem } from '../tooltips/TooltipLogItem';

export interface ThreatTooltipProps {
	log: ThreatLogGroup;
}

export const ThreatTooltip = ({ log }: ThreatTooltipProps) => (
	<div className="timeline-tooltip threat">
		<div className="timeline-tooltip-header">
			<span className="bold">{log.timestamp.toFixed(2)}s</span>
		</div>
		<div className="timeline-tooltip-body">
			<div className="timeline-tooltip-body-row">
				<span className="series-color">
					{i18n.t('results_tab.details.timeline.tooltips.before')}: {log.threatBefore.toFixed(1)}
				</span>
			</div>
			<ul className="timeline-threat-events">
				{log.logs.map((threatLog, index) => (
					<TooltipLogItem key={index} log={threatLog}>
						{threatLog.threat.toFixed(1)} {i18n.t('results_tab.details.timeline.tooltips.threat')}
					</TooltipLogItem>
				))}
			</ul>
			<div className="timeline-tooltip-body-row">
				<span className="series-color">
					{i18n.t('results_tab.details.timeline.tooltips.after')}: {log.threatAfter.toFixed(1)}
				</span>
			</div>
		</div>
		<TooltipAuras log={log} />
	</div>
);
