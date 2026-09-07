import { useSimHost } from '@sim/context/SimHostContext';
import { SavedEPWeights } from '@generated/proto/ui';
import { useSavedData } from '@ui-kit/hooks/useSavedData';

export const useSavedEpWeights = () => useSavedData(useSimHost().getSavedEPWeightsStorageKey(), SavedEPWeights);
