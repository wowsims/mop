import { usePlayer } from '@sim/context/SimHostContext';
import { useStoreSubscribe } from '@sim/hooks/useStoreSubscribe';
import type { ActionId } from '@sim/proto/action_id';
import { subscribeAll, subscribePlayerField, subscribeUnitMetadata } from '@sim/state/subscriptions';

import { availableCooldowns } from '../components/CooldownsPicker/utils';

export const useAvailableCooldowns = (): Array<ActionId> => {
	const player = usePlayer();
	const subscribe = subscribeAll([subscribePlayerField(player, 'rotation'), subscribeUnitMetadata(player.sim)]);
	return useStoreSubscribe(subscribe, () => availableCooldowns(player));
};
