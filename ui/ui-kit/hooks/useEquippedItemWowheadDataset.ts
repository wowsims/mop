import type { Player } from '@sim/player/player';
import { equippedItemWowheadTooltipData } from '@sim/proto/action_id/dom';
import type { EquippedItem } from '@sim/proto/equipped_item';
import { useMemo } from 'react';

import { useWowheadDataset, type WowheadDatasetTarget } from './useWowheadDataset';

export const useEquippedItemWowheadDataset = (
	target: WowheadDatasetTarget | Array<WowheadDatasetTarget>,
	player: Player<any>,
	item: EquippedItem | null | undefined,
	isBlacksmithing: boolean,
) => {
	const resolve = useMemo(() => (item ? () => equippedItemWowheadTooltipData(player, item, isBlacksmithing) : null), [player, item, isBlacksmithing]);
	useWowheadDataset(target, resolve);
};
