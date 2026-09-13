import i18n from '@i18n/config';
import type { DpsLog } from '@sim/proto/combat_log';

import { DamageResult } from '../../DamageResult';
import { TooltipAuras } from '../tooltips/TooltipAuras';
import { TooltipLogItem } from '../tooltips/TooltipLogItem';

export interface DpsTooltipProps {
	log: DpsLog;
}

export const DpsTooltip = ({ log }: DpsTooltipProps) => (
	<div className="timeline-tooltip dps">
		<div className="timeline-tooltip-header">
			<span className="bold">{log.timestamp.toFixed(2)}s</span>
		</div>
		<div className="timeline-tooltip-body">
			<ul className="timeline-dps-events">
				{log.damageLogs.map((damageLog, index) => (
					<TooltipLogItem key={index} log={damageLog}>
						<DamageResult log={damageLog} />
					</TooltipLogItem>
				))}
			</ul>
			<div className="timeline-tooltip-body-row">
				<span className="series-color">
					{i18n.t('results_tab.details.timeline.tooltips.dps')}: {log.dps.toFixed(2)}
				</span>
			</div>
		</div>
		<TooltipAuras log={log} />
	</div>
);
