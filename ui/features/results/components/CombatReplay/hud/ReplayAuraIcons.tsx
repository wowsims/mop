import type { ClassValue } from 'clsx';
import clsx from 'clsx';

import { useFrameList } from '../../../hooks/useReplayFrame';
import type { ReplayAura } from '../../../model/replay';
import { activeAuras } from '../../../model/replay';
import { auraKey } from '../utils';
import { ReplayAuraIcon } from './ReplayAuraIcon';

export interface ReplayAuraIconsProps {
	className: ClassValue;
	auras: ReadonlyArray<ReplayAura>;
}

/** Whatever is up right now, soonest to expire first — the player's buff row, and each enemy's debuffs. */
export const ReplayAuraIcons = ({ className, auras }: ReplayAuraIconsProps) => {
	const active = useFrameList(auras, time => activeAuras(auras, time), auraKey);

	return (
		<div className={clsx(className)}>
			{active.map(aura => (
				<ReplayAuraIcon key={auraKey(aura)} aura={aura} />
			))}
		</div>
	);
};
