import './CooldownsPicker.scss';

import i18n from '@i18n/config';
import { usePlayer } from '@sim/context/SimHostContext';
import { useStoreSubscribe } from '@sim/hooks/useStoreSubscribe';
import { subscribeAll, subscribePlayerField, subscribeUnitMetadata } from '@sim/state/subscriptions';
import { Tooltip } from '@ui-kit/Tooltip';
import { useId } from 'react';

import { useAvailableCooldowns } from '../../hooks/useAvailableCooldowns';
import { CooldownRow } from './CooldownRow';

export const CooldownsPicker = () => {
	const player = usePlayer();
	const deleteTooltipId = useId();

	const subscribe = subscribeAll([subscribePlayerField(player, 'rotation'), subscribeUnitMetadata(player.sim)]);
	const cooldowns = useStoreSubscribe(subscribe, () => player.getSimpleCooldowns().cooldowns);
	const available = useAvailableCooldowns();

	return (
		<div className="cooldowns-picker-root">
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
