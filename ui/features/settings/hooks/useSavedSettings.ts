import { useSimHost } from '@sim/context/SimHostContext';
import { SavedSettings } from '@generated/proto/ui';
import { useSavedData } from '@ui-kit/hooks/useSavedData';

export const useSavedSettings = () => useSavedData(useSimHost().getSavedSettingsStorageKey(), SavedSettings);
