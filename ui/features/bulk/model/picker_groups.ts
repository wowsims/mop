// `@sim/bulk/utils` reaches `@i18n/entity_mapping`, which reads `BulkSimItemSlot` at module
// scope, so importing the enum through it is a cycle. `constants_auto_gen` depends on the generated
// protos and nothing else.
import { BulkSimItemSlot } from '@sim/bulk/constants_auto_gen';
import type { BulkPickerEntry } from '@sim/bulk/types';
import type { EquippedItem } from '@sim/proto/equipped_item';
import type { ItemSlot } from '@generated/proto/common';

const DUAL_SLOTS = [BulkSimItemSlot.ItemSlotHandWeapon, BulkSimItemSlot.ItemSlotFinger, BulkSimItemSlot.ItemSlotTrinket];

// True when the slot already holds as many copies of this exact item as can be worn.
// Finger/trinket/weapon map to two physical slots, so two copies of a non-unique item fit.
// A shared limit category is deliberately allowed: ilvl tiers of one trinket are distinct
// ids (Evil Eye of Galakras ships six, all category 326) and comparing them is the point.
const isDuplicateOfExisting = (bulkSlot: BulkSimItemSlot, entries: readonly BulkPickerEntry[], item: EquippedItem): boolean => {
	const maxCopies = DUAL_SLOTS.includes(bulkSlot) && !item._item.unique ? 2 : 1;
	return entries.filter(entry => entry.item.id === item.id).length >= maxCopies;
};

export const pickerEntryAt = (entries: readonly BulkPickerEntry[], index: number): BulkPickerEntry | null =>
	entries.find(entry => entry.index === index) ?? null;

export const removePickerEntry = (entries: readonly BulkPickerEntry[], index: number): readonly BulkPickerEntry[] =>
	entries.filter(entry => entry.index !== index);

/**
 * One slot group's entries with `item` at `index`, in render order, or `'duplicate'`.
 *
 * Equipped entries are unshifted and user entries pushed, which is the order the vanilla group's
 * `insertAdjacentElement('afterbegin')` produced: the equipped pair ends up reversed against slot
 * order, and the batch's own items follow in index order.
 */
export const addPickerEntry = (
	bulkSlot: BulkSimItemSlot,
	entries: readonly BulkPickerEntry[],
	index: number,
	item: EquippedItem,
): readonly BulkPickerEntry[] | 'duplicate' => {
	// Equipped entries (index < 0) report what is worn rather than offering a choice, so they
	// always render — the guard must never hide one.
	if (index >= 0 && isDuplicateOfExisting(bulkSlot, entries, item)) return 'duplicate';

	const rest = removePickerEntry(entries, index);
	return index < 0 ? [{ index, item }, ...rest] : [...rest, { index, item }];
};

/** Null when nothing is at `index`, so the caller can raise its own notice. */
export const updatePickerEntry = (entries: readonly BulkPickerEntry[], index: number, item: EquippedItem): readonly BulkPickerEntry[] | null =>
	pickerEntryAt(entries, index) ? entries.map(entry => (entry.index === index ? { index, item } : entry)) : null;

/**
 * Which of the group's two physical slots holds `frozenItem`, or null.
 *
 * Identity first, then value: a frozen item is captured off the gear it was frozen from, and an
 * equivalent piece moved into the other slot should still read as frozen.
 */
export const frozenItemSlot = (
	gear: { getEquippedItem: (slot: ItemSlot) => EquippedItem | null },
	slots: readonly ItemSlot[] | undefined,
	frozenItem: EquippedItem | null | undefined,
): ItemSlot | null => {
	if (!frozenItem || !slots) return null;
	return slots.find(slot => gear.getEquippedItem(slot) === frozenItem) ?? slots.find(slot => gear.getEquippedItem(slot)?.equals(frozenItem)) ?? null;
};
