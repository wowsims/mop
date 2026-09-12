import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useCopyToClipboard } from './useCopyToClipboard';

let copied: string[];

beforeEach(() => {
	vi.useFakeTimers();
	copied = [];
	vi.stubGlobal('navigator', {
		clipboard: {
			writeText: vi.fn((text: string) => {
				copied.push(text);
				return Promise.resolve();
			}),
		},
	});
});

afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllGlobals();
});

describe('useCopyToClipboard', () => {
	it('reads the content getter at click time, not at mount', () => {
		let payload = 'before';
		const getContent = vi.fn(() => payload);
		const { result } = renderHook(() => useCopyToClipboard(getContent));

		expect(getContent).not.toHaveBeenCalled();

		payload = 'after';
		act(() => result.current.copy());

		expect(getContent).toHaveBeenCalledTimes(1);
		expect(copied).toEqual(['after']);
	});

	it('runs the latest getter a re-render handed it', () => {
		const { result, rerender } = renderHook(({ getContent }) => useCopyToClipboard(getContent), { initialProps: { getContent: () => 'first' } });

		rerender({ getContent: () => 'second' });
		act(() => result.current.copy());

		expect(copied).toEqual(['second']);
	});

	it('reports copied, and reverts after 1500ms', () => {
		const { result } = renderHook(() => useCopyToClipboard(() => 'payload'));
		expect(result.current.copied).toBe(false);

		act(() => result.current.copy());
		expect(result.current.copied).toBe(true);

		act(() => void vi.advanceTimersByTime(1499));
		expect(result.current.copied).toBe(true);

		act(() => void vi.advanceTimersByTime(1));
		expect(result.current.copied).toBe(false);
	});

	it('ignores clicks until the copied window ends, two in one task included', () => {
		const getContent = vi.fn(() => 'payload');
		const { result } = renderHook(() => useCopyToClipboard(getContent));

		act(() => {
			result.current.copy();
			result.current.copy();
		});
		expect(getContent).toHaveBeenCalledTimes(1);
		expect(copied).toHaveLength(1);

		act(() => result.current.copy());
		expect(copied).toHaveLength(1);

		act(() => void vi.advanceTimersByTime(1500));
		act(() => result.current.copy());
		expect(copied).toHaveLength(2);
	});

	it('drops its revert timer on unmount', () => {
		const { result, unmount } = renderHook(() => useCopyToClipboard(() => 'payload'));

		act(() => result.current.copy());
		expect(vi.getTimerCount()).toBe(1);

		unmount();
		expect(vi.getTimerCount()).toBe(0);
	});
});
