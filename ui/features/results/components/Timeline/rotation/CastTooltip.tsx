import i18n from '@i18n/config';
import type { CastLog } from '@sim/proto/combat_log';

import { DamageResult } from '../../DamageResult';

export interface CastTooltipProps {
	log: CastLog;
}

export const CastTooltip = ({ log }: CastTooltipProps) => {
	const travelTime = log.travelTime == 0 ? '' : ` + ${log.travelTime.toFixed(2)}s travel time`;
	const totalDamage = log.damageDealtLogs.reduce((total, ddl) => total + ddl.amount, 0);

	return (
		<div className="timeline-tooltip">
			<span>
				{log.actionId!.name} from {log.timestamp.toFixed(2)}s to{' '}
				{(log.castCancelledLog ? log.castCancelledLog.timestamp : log.timestamp + log.castTime).toFixed(2)}s
				{log.castCancelledLog
					? ` (Cancelled after ${log.cancelTime.toFixed(2)}s)`
					: ` (${log.castTime > 0 ? `${log.castTime.toFixed(2)}s, ` : ''}${log.effectiveTime.toFixed(2)}s GCD Time)`}
				{travelTime.length > 0 && travelTime}
			</span>
			{totalDamage > 0 && (
				<span>
					Total: {totalDamage.toFixed(2)} ({(totalDamage / (log.effectiveTime || 1)).toFixed(2)} DPET)
				</span>
			)}
			{log.damageDealtLogs.length > 0 && (
				<ul className="rotation-item-damage-list">
					{log.damageDealtLogs.map((ddl, index) => (
						<li key={index}>
							<span>
								{ddl.timestamp.toFixed(2)}s - <DamageResult log={ddl} />
							</span>
							{!ddl.source?.isTarget && (
								<span className="threat-metrics">
									{' '}
									({ddl.threat.toFixed(1)} {i18n.t('results_tab.details.timeline.tooltips.threat')})
								</span>
							)}
						</li>
					))}
				</ul>
			)}
		</div>
	);
};
