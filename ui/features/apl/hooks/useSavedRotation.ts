import { SavedRotation } from '@generated/proto/ui';
import { useSimHost } from '@sim/context/SimHostContext';
import { useSavedData } from '@ui-kit/hooks/useSavedData';

export const useSavedRotation = () => useSavedData(useSimHost().getSavedRotationStorageKey(), SavedRotation);
