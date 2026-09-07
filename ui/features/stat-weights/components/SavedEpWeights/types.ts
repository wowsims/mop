import type { Player } from '@sim/player';
import type { SavedEPWeights } from '@generated/proto/ui';

export interface SavedEpWeightsEntry {
	name: string;
	data: SavedEPWeights;
	json: string;
	isPreset: boolean;
	enableWhen?: (player: Player<any>) => boolean;
	onLoad?: (player: Player<any>) => void;
}
