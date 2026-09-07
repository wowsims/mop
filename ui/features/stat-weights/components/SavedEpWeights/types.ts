import type { Player } from '@sim/player';
import type { SavedEPWeights } from '@generated/proto/ui';
import type { SavedDataEntry } from '@ui-kit/hooks/useSavedData';

export interface SavedEpWeightsEntry extends SavedDataEntry<SavedEPWeights> {
	isPreset?: boolean;
	enableWhen?: (player: Player<any>) => boolean;
	onLoad?: (player: Player<any>) => void;
}
