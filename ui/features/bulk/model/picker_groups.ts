// `@sim/bulk/utils` reaches `@i18n/entity_mapping`, which reads `BulkSimItemSlot` at module
// scope, so importing the enum through it is a cycle. `constants_auto_gen` depends on the generated
// protos and nothing else.
import { BulkSimItemSlot } from '@sim/bulk/constants_auto_gen';
import type { EquippedItem } from '@sim/proto/equipped_item';
import type { ItemSlot } from '@generated/proto/common';

export interface BulkPickerEntry {
	/** Index into the batch's item array, or -1/-2 for the two equipped slots this group covers. */
	index: number;
	item: EquippedItem;
}

export type BulkPickerAddResult = 'added' | 'duplicate';

const DUAL_SLOTS = [BulkSimItemSlot.ItemSlotHandWeapon, BulkSimItemSlot.ItemSlotFinger, BulkSimItemSlot.ItemSlotTrinket];

/**
 * One slot group's entries, in render order.
 *
 * Equipped entries are unshifted and user entries pushed, which is the order the vanilla group's
 * `insertAdjacentElement('afterbegin')` produced: the equipped pair ends up reversed against slot
 * order, and the batch's own items follow in index order.
 */
export class BulkPickerGroup {
	private readonly order: BulkPickerEntry[] = [];

	constructor(readonly bulkSlot: BulkSimItemSlot) {}

	get entries(): readonly BulkPickerEntry[] {
		return this.order;
	}

	get items(): EquippedItem[] {
		return this.order.map(entry => entry.item);
	}

	has(index: number): boolean {
		return this.order.some(entry => entry.index === index);
	}

	// True when the slot already holds as many copies of this exact item as can be worn.
	// Finger/trinket/weapon map to two physical slots, so two copies of a non-unique item fit.
	// A shared limit category is deliberately allowed: ilvl tiers of one trinket are distinct
	// ids (Evil Eye of Galakras ships six, all category 326) and comparing them is the point.
	private isDuplicateOfExisting(item: EquippedItem): boolean {
		const maxCopies = DUAL_SLOTS.includes(this.bulkSlot) && !item._item.unique ? 2 : 1;
		return this.order.filter(entry => entry.item.id === item.id).length >= maxCopies;
	}

	add(index: number, item: EquippedItem): BulkPickerAddResult {
		// Equipped entries (index < 0) report what is worn rather than offering a choice, so they
		// always render — the guard must never hide one.
		if (index >= 0 && this.isDuplicateOfExisting(item)) return 'duplicate';

		this.remove(index);
		if (index < 0) this.order.unshift({ index, item });
		else this.order.push({ index, item });
		return 'added';
	}

	update(index: number, item: EquippedItem): boolean {
		const entry = this.order.find(candidate => candidate.index === index);
		if (!entry) return false;
		entry.item = item;
		return true;
	}

	remove(index: number): BulkPickerEntry | null {
		const at = this.order.findIndex(entry => entry.index === index);
		if (at < 0) return null;
		return this.order.splice(at, 1)[0];
	}
}

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
