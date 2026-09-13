import type { ReplayAction } from '../../../model/replay';
import { tickerDamageLabel } from '../../../model/replay';
import { ReplayIcon } from '../ReplayIcon';

export interface ReplayTickerIconProps {
	action: ReplayAction;
	/** The cast the playhead is on, which keeps the strip's highlight. */
	latest: boolean;
	opacity: number;
}

const STRIP_ICON_CLASSES =
	'cr-strip-icon ui-combat-replay-icon inset-ring-2 inset-ring-white-15 data-active:inset-ring-white-70 data-active:shadow-glow-white-30';

export const ReplayTickerIcon = ({ action, latest, opacity }: ReplayTickerIconProps) => (
	<ReplayIcon actionId={action.actionId} className={STRIP_ICON_CLASSES} tooltip="spell" style={{ opacity }} active={latest}>
		{action.isCrit && <span className="cr-crit-badge absolute right-[2px] top-[2px] text-[9px] font-black leading-none text-damage-crit">!</span>}
		{action.dmg != null && action.dmg > 0 && <span className="cr-dmg-badge ui-combat-replay-badge">{tickerDamageLabel(action.dmg)}</span>}
	</ReplayIcon>
);
