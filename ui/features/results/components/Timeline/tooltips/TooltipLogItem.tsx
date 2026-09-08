import type { CombatLog } from '@sim/proto/combat_log';
import type { ReactNode } from 'react';

export interface TooltipLogItemProps {
	log: CombatLog;
	children: ReactNode;
}

export const TooltipLogItem = ({ log, children }: TooltipLogItemProps) => (
	<li>
		{log.actionId?.iconUrl && <img className="timeline-tooltip-icon" src={log.actionId.iconUrl} alt="" />}
		{log.actionId && <span>{log.actionId.name}</span>}
		<span className="series-color">{children}</span>
	</li>
);
