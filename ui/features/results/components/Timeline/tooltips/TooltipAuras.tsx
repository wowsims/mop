import i18n from '@i18n/config';
import type { CombatLog } from '@sim/proto/combat_log';

export interface TooltipAurasProps {
	log: CombatLog;
}

/** The auras that were up when the log fired. Nothing at all when there were none. */
export const TooltipAuras = ({ log }: TooltipAurasProps) => {
	if (log.activeAuras.length === 0) return null;

	return (
		<div className="timeline-tooltip-auras border-t border-solid border-white">
			<div className="ui-timeline-tooltip-body-row timeline-tooltip-body-row">
				<span className="font-bold">{i18n.t('results_tab.details.timeline.tooltips.active_auras')}</span>
			</div>
			<ul className="timeline-active-auras block max-h-[56vh] columns-2 gap-4">
				{log.activeAuras.map((auraLog, index) => (
					<li key={index} className="mb-1 break-inside-avoid">
						{auraLog.actionId!.iconUrl && <img className="timeline-tooltip-icon size-[20px]" src={auraLog.actionId!.iconUrl} alt="" />}
						<span>{auraLog.actionId!.name}</span>
					</li>
				))}
			</ul>
		</div>
	);
};
