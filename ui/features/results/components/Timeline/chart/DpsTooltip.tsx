import i18n from '@i18n/config';
import type { DpsLog } from '@sim/proto/combat_log';

import { DamageResult } from '../../DamageResult';
import { TooltipAuras } from '../tooltips/TooltipAuras';
import { TooltipLogItem } from '../tooltips/TooltipLogItem';

export interface DpsTooltipProps {
	log: DpsLog;
}

export const DpsTooltip = ({ log }: DpsTooltipProps) => (
	<div className="ui-timeline-tooltip">
		<div data-testid="timeline-tooltip-header" className="ui-timeline-tooltip-header">
			<span className="font-bold">{log.timestamp.toFixed(2)}s</span>
		</div>
		<div className="ui-timeline-tooltip-body">
			<ul data-testid="timeline-dps-events" className="max-h-[40vh] overflow-y-auto">
				{log.damageLogs.map((damageLog, index) => (
					<TooltipLogItem key={index} log={damageLog}>
						<DamageResult log={damageLog} />
					</TooltipLogItem>
				))}
			</ul>
			<div data-testid="timeline-tooltip-body-row" className="ui-timeline-tooltip-body-row">
				<span data-testid="series-color" className="font-bold">
					{i18n.t('results_tab.details.timeline.tooltips.dps')}: {log.dps.toFixed(2)}
				</span>
			</div>
		</div>
		<TooltipAuras log={log} />
	</div>
);
