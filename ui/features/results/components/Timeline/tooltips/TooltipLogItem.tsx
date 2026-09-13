import type { CombatLog } from '@sim/proto/combat_log';
import clsx from 'clsx';
import type { ReactNode } from 'react';

export interface TooltipLogItemProps {
	log: CombatLog;
	children: ReactNode;
	seriesColorClass?: string;
}

export const TooltipLogItem = ({ log, children, seriesColorClass }: TooltipLogItemProps) => (
	<li>
		{log.actionId?.iconUrl && <img className="timeline-tooltip-icon size-[20px]" src={log.actionId.iconUrl} alt="" />}
		{log.actionId && <span>{log.actionId.name}</span>}
		<span className={clsx('series-color font-bold', seriesColorClass)}>{children}</span>
	</li>
);
