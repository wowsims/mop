import type { Player } from '@sim/player/player';
import { equippedItemWowheadTooltipData } from '@sim/proto/action_id/tooltip_data';
import type { EquippedItem } from '@sim/proto/equipped_item';
import { useMemo } from 'react';

import { useWowheadDataset } from './useWowheadDataset';

export const useEquippedItemWowheadDataset = (player: Player<any>, item: EquippedItem | null | undefined, isBlacksmithing: boolean) => {
	const resolve = useMemo(() => (item ? () => equippedItemWowheadTooltipData(player, item, isBlacksmithing) : null), [player, item, isBlacksmithing]);
	return useWowheadDataset(resolve);
};
