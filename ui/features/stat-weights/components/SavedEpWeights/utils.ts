import type { Stats } from '@sim/proto_utils/stats';
import { SavedEPWeights } from '@generated/proto/ui';

import type { SavedEpWeightsEntry } from './types';

export const epWeightsData = (weights: Stats): SavedEPWeights => SavedEPWeights.create({ epWeights: weights.toProto() });

export const serializeEpWeights = (data: SavedEPWeights): string => JSON.stringify(SavedEPWeights.toJson(data));

export const makeEntry = (name: string, data: SavedEPWeights, isPreset: boolean): SavedEpWeightsEntry => ({
	name,
	data,
	json: serializeEpWeights(data),
	isPreset,
});
