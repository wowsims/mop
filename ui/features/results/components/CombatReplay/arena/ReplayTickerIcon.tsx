import clsx from 'clsx';

import type { ReplayAction } from '../../../model/replay';
import { tickerDamageLabel } from '../../../model/replay';
import { ReplayIcon } from '../ReplayIcon';

export interface ReplayTickerIconProps {
	action: ReplayAction;
	/** The cast the playhead is on, which keeps the strip's highlight. */
	latest: boolean;
	opacity: number;
}

export const ReplayTickerIcon = ({ action, latest, opacity }: ReplayTickerIconProps) => (
	<ReplayIcon actionId={action.actionId} className={clsx('cr-strip-icon', latest && 'cr-strip-icon-active')} tooltip="spell" style={{ opacity }}>
		{action.isCrit && <span className="cr-crit-badge">!</span>}
		{action.dmg != null && action.dmg > 0 && <span className="cr-dmg-badge">{tickerDamageLabel(action.dmg)}</span>}
	</ReplayIcon>
);
