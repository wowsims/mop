import { SavedRotation } from '@generated/proto/ui';

export const serializeRotation = (data: SavedRotation): string => JSON.stringify(SavedRotation.toJson(data));
