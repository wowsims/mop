import { SavedGearSet } from '@generated/proto/ui';
import type { Player } from '@sim/player/player';

export const gearSetData = (player: Player<any>): SavedGearSet =>
	SavedGearSet.create({ gear: player.getGear().asSpec(), bonusStatsStats: player.getBonusStats().toProto() });

export const serializeGearSet = (data: SavedGearSet): string => JSON.stringify(SavedGearSet.toJson(data));
