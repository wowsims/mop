import { useSimHost } from '@sim/context/SimHostContext';
import { SavedGearSet } from '@generated/proto/ui';
import { useSavedData } from '@ui-kit/hooks/useSavedData';

export const useSavedGear = () => useSavedData(useSimHost().getSavedGearStorageKey(), SavedGearSet);
