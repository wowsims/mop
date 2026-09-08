import type { GemColor } from '@generated/proto/common';
import type { EquippedItem } from '@sim/proto/equipped_item';

export interface GearChangeSocket {
	socketColor: GemColor;
	gemName: string | undefined;
	changed: boolean;
}

/**
 * One entry per socket of the new item. `changed` walks the *previous* item's sockets, as the
 * vanilla builder does, so a slot that gained sockets reports only the ones it already had.
 */
export const gearChangeSockets = (item: EquippedItem | undefined, previousItem: EquippedItem | undefined): GearChangeSocket[] => {
	if (!item) return [];
	const gems = item.gems;
	const previousGems = previousItem?.gems;
	const changed = new Set<number>();
	previousItem?.gemSockets.forEach((_socketColor, socketIdx) => {
		if (previousGems?.[socketIdx]?.id !== gems[socketIdx]?.id) changed.add(socketIdx);
	});

	return item.allSocketColors().map((socketColor, gemIdx) => ({
		socketColor,
		gemName: gems[gemIdx]?.name,
		changed: changed.has(gemIdx),
	}));
};
