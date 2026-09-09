import { BulkSimItemSlot } from '@sim/bulk/constants_auto_gen';
import type { EquippedItem } from '@sim/proto/equipped_item';
import { ItemSlot } from '@generated/proto/common';
import { describe, expect, it } from 'vitest';

import { BulkPickerGroup, frozenItemSlot } from './picker_groups';

const item = (id: number, unique = false) => ({ id, _item: { id, unique } }) as unknown as EquippedItem;
const order = (group: BulkPickerGroup) => group.entries.map(entry => entry.index);

describe('BulkPickerGroup', () => {
	it('puts equipped entries in front of the batch and keeps the batch in index order', () => {
		const group = new BulkPickerGroup(BulkSimItemSlot.ItemSlotHead);
		group.add(0, item(1));
		group.add(1, item(2));
		// Finger 1 then Finger 2, which the vanilla group prepended one after the other.
		group.add(-1, item(3));
		group.add(-2, item(4));

		expect(order(group)).toEqual([-2, -1, 0, 1]);
	});

	it('rejects a second copy in a single-slot group and allows two in a paired one', () => {
		const head = new BulkPickerGroup(BulkSimItemSlot.ItemSlotHead);
		expect(head.add(0, item(7))).toBe('added');
		expect(head.add(1, item(7))).toBe('duplicate');

		const finger = new BulkPickerGroup(BulkSimItemSlot.ItemSlotFinger);
		expect(finger.add(0, item(7))).toBe('added');
		expect(finger.add(1, item(7))).toBe('added');
		expect(finger.add(2, item(7))).toBe('duplicate');
	});

	it('allows only one copy of a unique item even in a paired slot', () => {
		const trinket = new BulkPickerGroup(BulkSimItemSlot.ItemSlotTrinket);
		expect(trinket.add(0, item(9, true))).toBe('added');
		expect(trinket.add(1, item(9, true))).toBe('duplicate');
	});

	it('never rejects an equipped entry, whatever is already in the group', () => {
		const head = new BulkPickerGroup(BulkSimItemSlot.ItemSlotHead);
		head.add(0, item(7));
		expect(head.add(-1, item(7))).toBe('added');
		expect(order(head)).toEqual([-1, 0]);
	});

	it('re-adding an index moves it rather than duplicating it', () => {
		const group = new BulkPickerGroup(BulkSimItemSlot.ItemSlotHead);
		group.add(0, item(1));
		group.add(1, item(2));
		group.add(0, item(3));

		expect(order(group)).toEqual([1, 0]);
		expect(group.items.map(entry => entry.id)).toEqual([2, 3]);
	});

	it('updates in place, and reports a miss so the caller can raise its own notice', () => {
		const group = new BulkPickerGroup(BulkSimItemSlot.ItemSlotHead);
		group.add(0, item(1));

		expect(group.update(0, item(5))).toBe(true);
		expect(group.items.map(entry => entry.id)).toEqual([5]);
		expect(group.update(3, item(6))).toBe(false);
	});

	it('hands the removed entry back, and null when there is nothing at that index', () => {
		const group = new BulkPickerGroup(BulkSimItemSlot.ItemSlotHead);
		group.add(0, item(1));

		expect(group.remove(0)?.item.id).toBe(1);
		expect(group.has(0)).toBe(false);
		expect(group.remove(0)).toBeNull();
	});
});

describe('frozenItemSlot', () => {
	const gearOf = (entries: Array<[ItemSlot, EquippedItem | null]>) => {
		const map = new Map(entries);
		return { getEquippedItem: (slot: ItemSlot) => map.get(slot) ?? null };
	};
	const SLOTS: ItemSlot[] = [ItemSlot.ItemSlotFinger1, ItemSlot.ItemSlotFinger2];
	const equatable = (id: number) => ({ id, equals: (other: { id: number }) => other?.id === id }) as unknown as EquippedItem;

	it('is null when nothing is frozen, and when the group has no slot pair', () => {
		expect(frozenItemSlot(gearOf([]), SLOTS, null)).toBeNull();
		expect(frozenItemSlot(gearOf([]), undefined, equatable(1))).toBeNull();
	});

	it('prefers the slot holding the very object that was frozen', () => {
		const first = equatable(1);
		const second = equatable(1);
		const gear = gearOf([
			[ItemSlot.ItemSlotFinger1, first],
			[ItemSlot.ItemSlotFinger2, second],
		]);

		expect(frozenItemSlot(gear, SLOTS, second)).toBe(ItemSlot.ItemSlotFinger2);
	});

	it('falls back to an equal item, so a piece moved between the pair stays frozen', () => {
		const gear = gearOf([[ItemSlot.ItemSlotFinger2, equatable(7)]]);

		expect(frozenItemSlot(gear, SLOTS, equatable(7))).toBe(ItemSlot.ItemSlotFinger2);
		expect(frozenItemSlot(gear, SLOTS, equatable(8))).toBeNull();
	});
});
