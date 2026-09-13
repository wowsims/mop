import { useRef } from 'react';

import { useReplayFrame } from '../../../hooks/useReplayFrame';
import type { ReplayAura } from '../../../model/replay';
import { auraFrame } from '../../../model/replay';
import { ReplayIcon } from '../ReplayIcon';

export interface ReplayAuraIconProps {
	aura: ReplayAura;
}

/** The icon is React's; the countdown, the stack count and the freshly-gained ring tick every frame. */
export const ReplayAuraIcon = ({ aura }: ReplayAuraIconProps) => {
	const anchor = useRef<HTMLAnchorElement>(null);
	const remaining = useRef<HTMLSpanElement>(null);
	const stacks = useRef<HTMLSpanElement>(null);

	useReplayFrame(time => {
		const frame = auraFrame(aura, time);
		if (remaining.current) remaining.current.textContent = frame.remaining;
		if (stacks.current) stacks.current.textContent = frame.stacks;
		anchor.current?.classList.toggle('cr-aura-icon-active', frame.fresh);
	});

	return (
		<ReplayIcon actionId={aura.actionId} className="cr-aura-icon" tooltip="buffAura" anchorRef={anchor}>
			<span ref={stacks} className="cr-aura-stack-badge" />
			<span ref={remaining} className="cr-aura-time-badge" />
		</ReplayIcon>
	);
};
