import { BulkSimItemSlot } from '@sim/bulk/constants_auto_gen';
import type { BulkPickerEntry } from '@sim/bulk/types';
import type { EquippedItem } from '@sim/proto/equipped_item';
import { ItemSlot } from '@generated/proto/common';
import { describe, expect, it } from 'vitest';

import { addPickerEntry, frozenItemSlot, pickerEntryAt, removePickerEntry, updatePickerEntry } from './picker_groups';

const item = (id: number, unique = false) => ({ id, _item: { id, unique } }) as unknown as EquippedItem;
const order = (entries: readonly BulkPickerEntry[]) => entries.map(entry => entry.index);
const addAll = (bulkSlot: BulkSimItemSlot, adds: Array<[number, EquippedItem]>): readonly BulkPickerEntry[] =>
	adds.reduce<readonly BulkPickerEntry[]>((entries, [index, added]) => {
		const next = addPickerEntry(bulkSlot, entries, index, added);
		if (next === 'duplicate') throw new Error(`rejected index ${index}`);
		return next;
	}, []);

describe('addPickerEntry', () => {
	it('puts equipped entries in front of the batch and keeps the batch in index order', () => {
		// Finger 1 then Finger 2, which the vanilla group prepended one after the other.
		const entries = addAll(BulkSimItemSlot.ItemSlotHead, [
			[0, item(1)],
			[1, item(2)],
			[-1, item(3)],
			[-2, item(4)],
		]);

		expect(order(entries)).toEqual([-2, -1, 0, 1]);
	});

	it('rejects a second copy in a single-slot group and allows two in a paired one', () => {
		const head = addAll(BulkSimItemSlot.ItemSlotHead, [[0, item(7)]]);
		expect(addPickerEntry(BulkSimItemSlot.ItemSlotHead, head, 1, item(7))).toBe('duplicate');

		const finger = addAll(BulkSimItemSlot.ItemSlotFinger, [
			[0, item(7)],
			[1, item(7)],
		]);
		expect(addPickerEntry(BulkSimItemSlot.ItemSlotFinger, finger, 2, item(7))).toBe('duplicate');
	});

	it('allows only one copy of a unique item even in a paired slot', () => {
		const trinket = addAll(BulkSimItemSlot.ItemSlotTrinket, [[0, item(9, true)]]);
		expect(addPickerEntry(BulkSimItemSlot.ItemSlotTrinket, trinket, 1, item(9, true))).toBe('duplicate');
	});

	it('never rejects an equipped entry, whatever is already in the group', () => {
		const head = addAll(BulkSimItemSlot.ItemSlotHead, [
			[0, item(7)],
			[-1, item(7)],
		]);
		expect(order(head)).toEqual([-1, 0]);
	});

	it('re-adding an index moves it rather than duplicating it', () => {
		const entries = addAll(BulkSimItemSlot.ItemSlotHead, [
			[0, item(1)],
			[1, item(2)],
			[0, item(3)],
		]);

		expect(order(entries)).toEqual([1, 0]);
		expect(entries.map(entry => entry.item.id)).toEqual([2, 3]);
	});

	it('leaves the entries it was given untouched', () => {
		const before = addAll(BulkSimItemSlot.ItemSlotHead, [[0, item(1)]]);
		addPickerEntry(BulkSimItemSlot.ItemSlotHead, before, 1, item(2));

		expect(order(before)).toEqual([0]);
	});
});

describe('updatePickerEntry', () => {
	it('replaces the entry, and reports a miss so the caller can raise its own notice', () => {
		const entries = addAll(BulkSimItemSlot.ItemSlotHead, [[0, item(1)]]);

		expect(updatePickerEntry(entries, 0, item(5))?.map(entry => entry.item.id)).toEqual([5]);
		expect(updatePickerEntry(entries, 3, item(6))).toBeNull();
	});
});

describe('removePickerEntry', () => {
	it('drops the entry at that index, and is a no-op when there is nothing there', () => {
		const entries = addAll(BulkSimItemSlot.ItemSlotHead, [[0, item(1)]]);
		expect(pickerEntryAt(entries, 0)?.item.id).toBe(1);

		const removed = removePickerEntry(entries, 0);
		expect(pickerEntryAt(removed, 0)).toBeNull();
		expect(removePickerEntry(removed, 0)).toEqual([]);
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
