import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { useTypedLocalStorage } from './useTypedLocalStorage';

const KEY = 'useTypedLocalStorage.test';

type Shape = { name: string; count: number };

const parseShape = (value: unknown): Shape | undefined =>
	value !== null && typeof value === 'object' && typeof (value as Shape).name === 'string' && typeof (value as Shape).count === 'number'
		? (value as Shape)
		: undefined;

beforeEach(() => window.localStorage.clear());
afterEach(() => window.localStorage.clear());

describe('useTypedLocalStorage', () => {
	it('returns undefined for an absent key', () => {
		const { result } = renderHook(() => useTypedLocalStorage<Shape>(KEY, parseShape));

		expect(result.current[0]).toBeUndefined();
	});

	it('returns undefined for a key holding valid JSON of the wrong shape', () => {
		window.localStorage.setItem(KEY, JSON.stringify({ wrong: 'shape' }));
		const { result } = renderHook(() => useTypedLocalStorage<Shape>(KEY, parseShape));

		expect(result.current[0]).toBeUndefined();
	});

	it('returns undefined for a key holding malformed JSON', () => {
		window.localStorage.setItem(KEY, '{oops');
		const { result } = renderHook(() => useTypedLocalStorage<Shape>(KEY, parseShape));

		expect(result.current[0]).toBeUndefined();
	});

	it('writes then reads back the same value', () => {
		const { result } = renderHook(() => useTypedLocalStorage<Shape>(KEY, parseShape));

		act(() => result.current[1]({ name: 'raiding', count: 4 }));

		expect(result.current[0]).toEqual({ name: 'raiding', count: 4 });
		expect(JSON.parse(window.localStorage.getItem(KEY)!)).toEqual({ name: 'raiding', count: 4 });
	});

	it('a second hook instance sees a value the first one wrote, via a fresh mount', () => {
		window.localStorage.setItem(KEY, JSON.stringify({ name: 'raiding', count: 4 }));

		const { result } = renderHook(() => useTypedLocalStorage<Shape>(KEY, parseShape));

		expect(result.current[0]).toEqual({ name: 'raiding', count: 4 });
	});

	it('remove clears the key and the returned value', () => {
		window.localStorage.setItem(KEY, JSON.stringify({ name: 'raiding', count: 4 }));
		const { result } = renderHook(() => useTypedLocalStorage<Shape>(KEY, parseShape));

		act(() => result.current[2]());

		expect(result.current[0]).toBeUndefined();
		expect(window.localStorage.getItem(KEY)).toBeNull();
	});
});
