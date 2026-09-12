import { SavedSettings } from '@generated/proto/ui';

export const serializeSettings = (data: SavedSettings): string => JSON.stringify(SavedSettings.toJson(data));
