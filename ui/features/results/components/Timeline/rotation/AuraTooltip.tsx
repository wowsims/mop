import type { AuraUptimeLog } from '@sim/proto/combat_log';

export interface AuraTooltipProps {
	log: AuraUptimeLog;
}

export const AuraTooltip = ({ log }: AuraTooltipProps) => (
	<div className="timeline-tooltip">
		<span>
			{log.actionId!.name}: {log.gainedAt.toFixed(2)}s - {log.fadedAt.toFixed(2)}s
		</span>
	</div>
);
