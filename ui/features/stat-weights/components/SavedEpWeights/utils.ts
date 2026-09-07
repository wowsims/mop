import type { Stats } from '@sim/proto_utils/stats';
import { SavedEPWeights } from '@generated/proto/ui';
import type { JsonValue } from '@protobuf-ts/runtime';

import type { SavedEpWeightsEntry } from './types';

export type StoredEpWeights = Record<string, JsonValue>;

export const parseStoredEpWeights = (value: unknown): StoredEpWeights | undefined =>
	value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as StoredEpWeights) : undefined;

export const epWeightsData = (weights: Stats): SavedEPWeights => SavedEPWeights.create({ epWeights: weights.toProto() });

export const serializeEpWeights = (data: SavedEPWeights): string => JSON.stringify(SavedEPWeights.toJson(data));

export const makeEntry = (name: string, data: SavedEPWeights, isPreset: boolean): SavedEpWeightsEntry => ({
	name,
	data,
	json: serializeEpWeights(data),
	isPreset,
});

export const entriesFrom = (stored: StoredEpWeights | undefined): Array<SavedEpWeightsEntry> => {
	const entries: Array<SavedEpWeightsEntry> = [];
	for (const name in stored) {
		try {
			entries.push(makeEntry(name, SavedEPWeights.fromJson(stored[name]), false));
		} catch (error) {
			console.warn('Failed parsing saved data: ', stored[name], error);
		}
	}
	return entries;
};

export const storedFrom = (entries: Array<SavedEpWeightsEntry>): StoredEpWeights => {
	const stored: StoredEpWeights = {};
	entries.forEach(entry => {
		stored[entry.name] = SavedEPWeights.toJson(entry.data);
	});
	return stored;
};
