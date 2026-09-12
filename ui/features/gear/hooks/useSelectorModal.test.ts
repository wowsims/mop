import { ItemSlot } from '@generated/proto/common';
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { GearData } from '../types';
import { SelectorModalTabs } from '../types';
import { useSelectorModalState } from './useSelectorModal';

const gearData: GearData = { equipItem: () => undefined, getEquippedItem: () => null, subscribe: () => () => undefined };

describe('useSelectorModalState', () => {
	it('starts closed with no request', () => {
		const { result } = renderHook(() => useSelectorModalState());
		expect(result.current.open).toBe(false);
		expect(result.current.request).toBeNull();
	});

	it('bumps the sequence on every open, including a reopen of the same slot and tab', () => {
		const { result } = renderHook(() => useSelectorModalState());
		act(() => result.current.openTab(ItemSlot.ItemSlotHead, SelectorModalTabs.Items, gearData));
		const first = result.current.request!.sequence;

		act(() => result.current.openTab(ItemSlot.ItemSlotHead, SelectorModalTabs.Items, gearData));
		expect(result.current.request!.sequence).toBe(first + 1);
		expect(result.current.open).toBe(true);
	});

	it('hands back a new state on open and on close, and the same one on a close that changes nothing', () => {
		const { result } = renderHook(() => useSelectorModalState());
		const closed = result.current;

		act(() => result.current.openTab(ItemSlot.ItemSlotNeck, SelectorModalTabs.Enchants, gearData));
		expect(result.current).not.toBe(closed);

		const opened = result.current;
		act(() => result.current.setOpen(false));
		expect(result.current).not.toBe(opened);

		// Identity is what a consumer renders on, so a no-op close must not produce a new one.
		const reclosed = result.current;
		act(() => result.current.setOpen(false));
		expect(result.current).toBe(reclosed);
	});

	it('leaves the last request in place when closed, the way the vanilla modal kept its contents', () => {
		const { result } = renderHook(() => useSelectorModalState());
		act(() => result.current.openTab(ItemSlot.ItemSlotFeet, SelectorModalTabs.Reforging, gearData));
		act(() => result.current.setOpen(false));
		expect(result.current.request).toMatchObject({ slot: ItemSlot.ItemSlotFeet, tab: SelectorModalTabs.Reforging });
	});
});
