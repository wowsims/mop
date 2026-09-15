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
		{log.actionId?.iconUrl && <img className="size-5" src={log.actionId.iconUrl} alt="" />}
		{log.actionId && <span>{log.actionId.name}</span>}
		<span data-testid="series-color" className={clsx('font-bold', seriesColorClass)}>
			{children}
		</span>
	</li>
);
