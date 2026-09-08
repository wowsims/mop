import i18n from '@i18n/config';
import type { DamageLog } from '@sim/proto/combat_log';

import { DamageResult } from '../../DamageResult';

export interface TickTooltipProps {
	log: DamageLog;
}

export const TickTooltip = ({ log }: TickTooltipProps) => (
	<div className="timeline-tooltip">
		<span>
			{log.timestamp.toFixed(2)}s - {log.actionId!.name} <DamageResult log={log} />
		</span>
		{!log.source?.isTarget && (
			<span className="threat-metrics">
				{' '}
				({log.threat.toFixed(1)} {i18n.t('results_tab.details.timeline.tooltips.threat')})
			</span>
		)}
	</div>
);
