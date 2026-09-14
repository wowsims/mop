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
		anchor.current?.toggleAttribute('data-active', frame.fresh);
	});

	return (
		<ReplayIcon actionId={aura.actionId} className="ui-combat-replay-icon shrink-0" tooltip="buffAura" anchorRef={anchor} testId="cr-aura-icon">
			<span
				ref={stacks}
				data-testid="cr-aura-stack-badge"
				className="absolute right-0.5 top-0.5 text-[9px] font-black leading-none text-white text-shadow-outline-soft"
			/>
			<span ref={remaining} data-testid="cr-aura-time-badge" className="ui-combat-replay-badge" />
		</ReplayIcon>
	);
};
