import { SavedRotation } from '@generated/proto/ui';
import { useSimHost } from '@sim/context/SimHostContext';
import { omitDeep } from '@sim/utils/collections';
import { useSavedData } from '@ui-kit/hooks/useSavedData';

// The live rotation is uuid-stripped, so a stored entry carrying uuids never compares equal to it.
const CODEC = { toJson: SavedRotation.toJson.bind(SavedRotation), fromJson: (json: any) => omitDeep(SavedRotation.fromJson(json), ['uuid']) };

export const useSavedRotation = () => useSavedData(useSimHost().getSavedRotationStorageKey(), CODEC);
