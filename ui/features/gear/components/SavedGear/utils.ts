import type { Player } from '@sim/player/player';
import { Stats } from '@sim/proto/stats';
import { SavedGearSet } from '@generated/proto/ui';

export const gearSetData = (player: Player<any>): SavedGearSet =>
	SavedGearSet.create({ gear: player.getGear().asSpec(), bonusStatsStats: player.getBonusStats().toProto() });

export const serializeGearSet = (data: SavedGearSet): string => JSON.stringify(SavedGearSet.toJson(data));
