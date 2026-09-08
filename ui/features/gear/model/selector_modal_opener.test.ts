import { ItemSlot } from '@generated/proto/common';
import { describe, expect, it, vi } from 'vitest';

import type { GearData } from '../types';
import { SelectorModalTabs } from '../types';
import { GearSelectorModalOpener } from './selector_modal_opener';

const gearData: GearData = { equipItem: () => undefined, getEquippedItem: () => null, subscribe: () => () => undefined };

describe('GearSelectorModalOpener', () => {
	it('starts closed with no request', () => {
		const opener = new GearSelectorModalOpener();
		expect(opener.isOpen()).toBe(false);
		expect(opener.getRequest()).toBeNull();
	});

	it('keeps the request identity stable between calls, so a subscriber does not loop', () => {
		const opener = new GearSelectorModalOpener();
		opener.openTab(ItemSlot.ItemSlotHead, SelectorModalTabs.Items, gearData);
		expect(opener.getRequest()).toBe(opener.getRequest());
	});

	it('bumps the sequence on every open, including a reopen of the same slot and tab', () => {
		const opener = new GearSelectorModalOpener();
		opener.openTab(ItemSlot.ItemSlotHead, SelectorModalTabs.Items, gearData);
		const first = opener.getRequest()!.sequence;
		opener.openTab(ItemSlot.ItemSlotHead, SelectorModalTabs.Items, gearData);
		expect(opener.getRequest()!.sequence).toBe(first + 1);
	});

	it('notifies on open and on close, and not on a close that changes nothing', () => {
		const opener = new GearSelectorModalOpener();
		const listener = vi.fn();
		opener.subscribe(listener);

		opener.openTab(ItemSlot.ItemSlotNeck, SelectorModalTabs.Enchants, gearData);
		expect(listener).toHaveBeenCalledTimes(1);
		expect(opener.isOpen()).toBe(true);

		opener.setOpen(false);
		expect(listener).toHaveBeenCalledTimes(2);
		opener.setOpen(false);
		expect(listener).toHaveBeenCalledTimes(2);
	});

	it('leaves the last request in place when closed, the way the vanilla modal kept its contents', () => {
		const opener = new GearSelectorModalOpener();
		opener.openTab(ItemSlot.ItemSlotFeet, SelectorModalTabs.Reforging, gearData);
		opener.setOpen(false);
		expect(opener.getRequest()).toMatchObject({ slot: ItemSlot.ItemSlotFeet, tab: SelectorModalTabs.Reforging });
	});

	it('stops notifying an unsubscribed listener', () => {
		const opener = new GearSelectorModalOpener();
		const listener = vi.fn();
		opener.subscribe(listener)();
		opener.openTab(ItemSlot.ItemSlotHead, SelectorModalTabs.Items, gearData);
		expect(listener).not.toHaveBeenCalled();
	});
});
