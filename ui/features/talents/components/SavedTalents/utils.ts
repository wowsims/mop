import type { Player } from '@sim/player';
import { SavedTalents } from '@generated/proto/ui';

export const talentsData = (player: Player<any>): SavedTalents => SavedTalents.create({ talentsString: player.getTalentsString(), glyphs: player.getGlyphs() });

export const serializeTalents = (data: SavedTalents): string => JSON.stringify(SavedTalents.toJson(data));
