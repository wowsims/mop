import { SavedTalents } from '@generated/proto/ui';

export const serializeTalents = (data: SavedTalents): string => JSON.stringify(SavedTalents.toJson(data));
