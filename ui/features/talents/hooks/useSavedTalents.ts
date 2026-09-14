import { SavedTalents } from '@generated/proto/ui';
import { useSimHost } from '@sim/context/SimHostContext';
import { useSavedData } from '@ui-kit/hooks/useSavedData';

export const useSavedTalents = () => useSavedData(useSimHost().getSavedTalentsStorageKey(), SavedTalents);
