import './CooldownsPicker.scss';

import i18n from '@i18n/config';
import { usePlayer } from '@sim/context/SimHostContext';
import { useStoreSubscribe } from '@sim/hooks/useStoreSubscribe';
import { subscribeAll, subscribePlayerField, subscribeUnitMetadata } from '@sim/state/subscriptions';
import { Tooltip } from '@ui-kit/Tooltip';
import { useEffect, useId, useMemo, useRef } from 'react';

import { CooldownRow } from './CooldownRow';
import { availableCooldowns } from './utils';

export const CooldownsPicker = () => {
	const player = usePlayer();
	const rootRef = useRef<HTMLDivElement>(null);
	const deleteTooltipId = useId();

	const subscribe = useMemo(() => subscribeAll([subscribePlayerField(player, 'rotation'), subscribeUnitMetadata(player.sim)]), [player]);
	const cooldowns = useStoreSubscribe(subscribe, () => player.getSimpleCooldowns().cooldowns);
	const available = useStoreSubscribe(subscribe, () => availableCooldowns(player));

	// The block this renders into hides itself when the spec offers no major cooldowns. Vanilla wrote
	// that class from inside the picker too; the alternative is the parent gating it, which needs this
	// subscription duplicated there.
	useEffect(() => {
		rootRef.current?.closest('.cooldown-settings')?.classList.toggle('hide', !available.length);
	}, [available.length]);

	return (
		<div className="cooldowns-picker-root" ref={rootRef}>
			{Array.from({ length: cooldowns.length + 1 }, (_, index) => (
				<CooldownRow
					key={index}
					index={index}
					id={cooldowns[index]?.id}
					available={available}
					isAdd={index === cooldowns.length}
					deleteTooltipId={deleteTooltipId}
				/>
			))}
			<Tooltip id={deleteTooltipId} content={i18n.t('rotation_tab.cooldowns.delete_tooltip')} />
		</div>
	);
};
