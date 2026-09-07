import type { Stats } from '@sim/proto_utils/stats';
import { SavedEPWeights } from '@generated/proto/ui';

export const epWeightsData = (weights: Stats): SavedEPWeights => SavedEPWeights.create({ epWeights: weights.toProto() });

export const serializeEpWeights = (data: SavedEPWeights): string => JSON.stringify(SavedEPWeights.toJson(data));
