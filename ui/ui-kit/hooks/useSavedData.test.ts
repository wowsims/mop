import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { SavedDataCodec } from './useSavedData';
import { useSavedData } from './useSavedData';

const KEY = 'test__saved_data';

interface Weights {
	value: number;
}

// Stands in for a generated `MessageType`: rejects anything that is not the shape it wrote.
const codec: SavedDataCodec<Weights> = {
	toJson: data => ({ value: data.value }),
	fromJson: json => {
		if (!json || typeof json !== 'object' || typeof (json as Weights).value !== 'number') throw new Error('not a Weights');
		return { value: (json as Weights).value };
	},
};

const store = (record: unknown) => window.localStorage.setItem(KEY, JSON.stringify(record));
const read = () => JSON.parse(window.localStorage.getItem(KEY)!);

beforeEach(() => window.localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe('useSavedData', () => {
	it('reads nothing from an absent key', () => {
		const { result } = renderHook(() => useSavedData(KEY, codec));
		expect(result.current.entries).toEqual([]);
	});

	it('parses each entry and carries its serialised form', () => {
		store({ raid: { value: 2 }, solo: { value: 7 } });
		const { result } = renderHook(() => useSavedData(KEY, codec));

		expect(result.current.entries).toEqual([
			{ name: 'raid', data: { value: 2 }, json: '{"value":2}' },
			{ name: 'solo', data: { value: 7 }, json: '{"value":7}' },
		]);
	});

	// One unreadable entry is the common case after a schema change; losing the whole slot to it
	// would throw away every other saved set the user has.
	it('skips an entry the codec rejects and keeps the rest', () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		store({ good: { value: 1 }, bad: { value: 'nope' } });

		const { result } = renderHook(() => useSavedData(KEY, codec));

		expect(result.current.entries.map(entry => entry.name)).toEqual(['good']);
		expect(warn).toHaveBeenCalledWith('Failed parsing saved data: ', { value: 'nope' }, expect.any(Error));
	});

	// The container guard is what makes this quiet: without it the array's indices walk into the
	// codec one by one and each rejection warns, so a stale key would spam the console on every read.
	it('reports nothing, and warns nothing, for a key holding valid JSON of the wrong shape', () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		store(['raid', 'solo']);

		const { result } = renderHook(() => useSavedData(KEY, codec));

		expect(result.current.entries).toEqual([]);
		expect(warn).not.toHaveBeenCalled();
	});

	it('appends a new name and writes it through the codec', () => {
		const { result } = renderHook(() => useSavedData(KEY, codec));

		act(() => result.current.save('raid', { value: 3 }));

		expect(read()).toEqual({ raid: { value: 3 } });
		expect(result.current.entries).toEqual([{ name: 'raid', data: { value: 3 }, json: '{"value":3}' }]);
	});

	it('replaces an existing name in place, keeping its position', () => {
		store({ raid: { value: 1 }, solo: { value: 2 } });
		const { result } = renderHook(() => useSavedData(KEY, codec));

		act(() => result.current.save('raid', { value: 9 }));

		expect(result.current.entries.map(entry => entry.name)).toEqual(['raid', 'solo']);
		expect(read()).toEqual({ raid: { value: 9 }, solo: { value: 2 } });
	});

	// A save that rebuilt the record from `entries` would drop everything the codec rejected, so a
	// single stale entry would be deleted by the user's next unrelated save.
	it('keeps an unreadable entry when something else is saved', () => {
		vi.spyOn(console, 'warn').mockImplementation(() => {});
		store({ stale: { value: 'nope' }, raid: { value: 1 } });
		const { result } = renderHook(() => useSavedData(KEY, codec));

		act(() => result.current.save('solo', { value: 5 }));

		expect(read()).toEqual({ stale: { value: 'nope' }, raid: { value: 1 }, solo: { value: 5 } });
	});

	it('removes one name and leaves the others', () => {
		store({ raid: { value: 1 }, solo: { value: 2 } });
		const { result } = renderHook(() => useSavedData(KEY, codec));

		act(() => result.current.remove('raid'));

		expect(read()).toEqual({ solo: { value: 2 } });
		expect(result.current.entries.map(entry => entry.name)).toEqual(['solo']);
	});
});
