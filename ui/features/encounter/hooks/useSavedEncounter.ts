import { SavedEncounter } from '@generated/proto/ui';
import { useSimHost } from '@sim/context/SimHostContext';
import { useSavedData } from '@ui-kit/hooks/useSavedData';

export const useSavedEncounter = () => useSavedData(useSimHost().getSavedEncounterStorageKey(), SavedEncounter);
