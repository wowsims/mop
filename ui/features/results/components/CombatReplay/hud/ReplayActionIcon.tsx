import { useRef } from 'react';

import { useReplayFrame } from '../../../hooks/useReplayFrame';
import type { ReplayAction } from '../../../model/replay';
import { isActionRecent } from '../../../model/replay';
import { ReplayIcon } from '../ReplayIcon';

export interface ReplayActionIconProps {
	action: ReplayAction;
	actions: ReadonlyArray<ReplayAction>;
}

/** Lights up while its spell is one of the last few cast — a class toggle, not a re-render. */
export const ReplayActionIcon = ({ action, actions }: ReplayActionIconProps) => {
	const anchor = useRef<HTMLAnchorElement>(null);

	useReplayFrame(time => {
		const recent = isActionRecent(actions, action.name, time);
		anchor.current?.classList.toggle('cr-action-icon-active', recent);
		anchor.current?.toggleAttribute('data-active', recent);
	});

	return <ReplayIcon actionId={action.actionId} className="cr-action-icon" tooltip="spell" anchorRef={anchor} />;
};
