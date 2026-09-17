import i18n from '@i18n/config';
import type { CombatLog } from '@sim/proto/combat_log';

export interface TooltipAurasProps {
	log: CombatLog;
}

/** The auras that were up when the log fired. Nothing at all when there were none. */
export const TooltipAuras = ({ log }: TooltipAurasProps) => {
	if (log.activeAuras.length === 0) return null;

	return (
		<div data-testid="timeline-tooltip-auras" className="border-t border-white">
			<div data-testid="timeline-tooltip-body-row" className="ui-timeline-tooltip-body-row">
				<span className="font-bold">{i18n.t('results_tab.details.timeline.tooltips.active_auras')}</span>
			</div>
			<ul data-testid="timeline-active-auras" className="block max-h-[56vh] columns-2 gap-4">
				{log.activeAuras.map((auraLog, index) => (
					<li key={index} className="mb-1 break-inside-avoid">
						{auraLog.actionId!.iconUrl && <img className="size-5" src={auraLog.actionId!.iconUrl} alt="" />}
						<span>{auraLog.actionId!.name}</span>
					</li>
				))}
			</ul>
		</div>
	);
};
