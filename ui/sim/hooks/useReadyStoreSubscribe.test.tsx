import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useReadyStoreSubscribe } from './useReadyStoreSubscribe';

const source = () => {
	const listeners = new Set<() => void>();
	const subscribe = (onChange: () => void) => {
		listeners.add(onChange);
		return () => listeners.delete(onChange);
	};
	return { subscribe, notify: () => listeners.forEach(listener => listener()), size: () => listeners.size };
};

describe('useReadyStoreSubscribe', () => {
	// The defect this exists for: `useSyncExternalStore` calls the snapshot on the first render, so a
	// read that dereferences `sim.db` throws long before any `useSimReady` gate turns true.
	it('never calls the read while not ready', () => {
		const { subscribe } = source();
		const read = vi.fn(() => 'value');

		const { result } = renderHook(() => useReadyStoreSubscribe(subscribe, read, false));

		expect(read).not.toHaveBeenCalled();
		expect(result.current).toBeNull();
	});

	it('does not subscribe to the source while not ready', () => {
		const { subscribe, size } = source();

		renderHook(() => useReadyStoreSubscribe(subscribe, () => 'value', false));

		expect(size()).toBe(0);
	});

	// Gating the read alone would leave the cached `null` in place: `useStoreSubscribe` only re-reads
	// when the subscription identity changes, so `ready` has to be part of it.
	it('drops the cached null and reads once ready flips', () => {
		const { subscribe } = source();
		const read = vi.fn(() => 'value');

		const { result, rerender } = renderHook(({ ready }) => useReadyStoreSubscribe(subscribe, read, ready), { initialProps: { ready: false } });
		expect(result.current).toBeNull();

		rerender({ ready: true });

		expect(result.current).toBe('value');
		expect(read).toHaveBeenCalled();
	});

	it('follows the source once ready', () => {
		const { subscribe, notify } = source();
		let value = 'first';

		const { result } = renderHook(() => useReadyStoreSubscribe(subscribe, () => value, true));
		expect(result.current).toBe('first');

		value = 'second';
		act(() => notify());

		expect(result.current).toBe('second');
	});
});
