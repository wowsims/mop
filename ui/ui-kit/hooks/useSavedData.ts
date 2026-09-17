import type { JsonValue } from '@protobuf-ts/runtime';
import { useCallback, useMemo, useRef } from 'react';

import { useTypedLocalStorage } from './useTypedLocalStorage';

// Every generated `MessageType` satisfies this structurally, so a named hook passes the proto itself.
export interface SavedDataCodec<T> {
	toJson: (data: T) => JsonValue;
	fromJson: (json: any) => T;
}

export interface SavedDataEntry<T> {
	name: string;
	data: T;
	// Serialised form, for comparing an entry against the live subject.
	json: string;
}

export interface UseSavedDataResult<T> {
	entries: Array<SavedDataEntry<T>>;
	save: (name: string, data: T) => void;
	remove: (name: string) => void;
}

type StoredRecord = Record<string, JsonValue>;

const parseStoredRecord = (value: unknown): StoredRecord | undefined =>
	value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as StoredRecord) : undefined;

// One saved-data slot: `Record<name, toJson(data)>` under one key, which is the shape every
// `SavedDataManager` has always written. Only the key and the codec vary between slots.
export const useSavedData = <T>(key: string, codec: SavedDataCodec<T>): UseSavedDataResult<T> => {
	const [stored, setStored] = useTypedLocalStorage<StoredRecord>(key, parseStoredRecord);
	// Held in a ref so a caller may pass the proto inline without churning every callback below.
	const codecRef = useRef(codec);
	codecRef.current = codec;
	const storedRef = useRef(stored);
	storedRef.current = stored;

	const entries = useMemo(() => {
		const parsed: Array<SavedDataEntry<T>> = [];
		for (const name in stored) {
			try {
				const data = codecRef.current.fromJson(stored[name]);
				parsed.push({ name, data, json: JSON.stringify(codecRef.current.toJson(data)) });
			} catch (error) {
				// One unreadable entry must not cost the user the rest of the slot.
				console.warn('Failed parsing saved data: ', stored[name], error);
			}
		}
		return parsed;
	}, [stored]);

	// Both writes patch the stored record rather than rebuilding it from `entries`, which would
	// silently drop every entry the codec rejected the moment the user saves anything else.
	const save = useCallback((name: string, data: T) => setStored({ ...(storedRef.current ?? {}), [name]: codecRef.current.toJson(data) }), [setStored]);

	const remove = useCallback(
		(name: string) => {
			const next = { ...(storedRef.current ?? {}) };
			delete next[name];
			setStored(next);
		},
		[setStored],
	);

	return { entries, save, remove };
};
