import i18n from '@i18n/config';
import { useSim } from '@sim/context/SimHostContext';
import { useDisplayMetrics } from '@sim/hooks/useDisplayMetrics';
import type { DamageLog } from '@sim/proto/combat_log';

import { DamageResult } from '../../DamageResult';

export interface TickTooltipProps {
	log: DamageLog;
}

export const TickTooltip = ({ log }: TickTooltipProps) => {
	const { threat: showThreatMetrics } = useDisplayMetrics(useSim());

	return (
		<div className="ui-timeline-tooltip">
			<span>
				{log.timestamp.toFixed(2)}s - {log.actionId!.name} <DamageResult log={log} />
			</span>
			{showThreatMetrics && !log.source?.isTarget && (
				<span>
					{' '}
					({log.threat.toFixed(1)} {i18n.t('results_tab.details.timeline.tooltips.threat')})
				</span>
			)}
		</div>
	);
};
