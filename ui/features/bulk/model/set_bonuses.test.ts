import { BulkRequiredSetBonus } from '@generated/proto/api';
import { ItemSlot } from '@generated/proto/common';
import { BulkSimItemSlot } from '@sim/bulk/constants_auto_gen';
import type { EquippedItem } from '@sim/proto/equipped_item';
import type { Gear } from '@sim/proto/gear';
import { describe, expect, it } from 'vitest';

import {
	BulkSetBonusOption,
	BulkSlotOptions,
	canEnableRequiredFourPiece,
	canEnableRequiredTwoPiece,
	getAvailableBulkSetBonuses,
	hasMatchingRequiredSetBonusCombination,
	nextRequiredSetBonuses,
	pruneRequiredSetBonuses,
	sanitiseRequiredSetBonuses,
} from './set_bonuses';

// The model reads exactly two things off an equipped item — its item's `setId`/`setName` and its
// `id` — and two off the gear. Standing the real classes up would drag the whole database in for
// no extra coverage.
const option = (id: number, setId = 0, setName = ''): EquippedItem => ({ item: { id, setId, setName } }) as unknown as EquippedItem;

const gearOf = (equipped: Partial<Record<ItemSlot, EquippedItem>>): Gear =>
	({
		getEquippedItem: (slot: ItemSlot) => equipped[slot] ?? null,
		getEquippedItems: () => Object.values(equipped),
	}) as unknown as Gear;

const required = (entries: Array<[number, number]>): Map<number, BulkRequiredSetBonus> =>
	new Map(entries.map(([setId, pieces]) => [setId, BulkRequiredSetBonus.create({ setId, pieces })]));

const setBonus = (setId: number, totalPieces: number, setName = `Set ${setId}`): BulkSetBonusOption => ({ setId, setName, totalPieces });

const always = () => true;
const never = () => false;

describe('getAvailableBulkSetBonuses', () => {
	it('counts distinct item ids, not pickers', () => {
		// Two ilvl tiers of one piece are two ids and count twice; the same id in two slots is one
		// piece, which is what stops a ring being offered as its own two-piece bonus.
		const slots: BulkSlotOptions = new Map([
			[BulkSimItemSlot.ItemSlotHead, [option(1, 10, 'Tier'), option(2, 10, 'Tier')]],
			[BulkSimItemSlot.ItemSlotChest, [option(1, 10, 'Tier')]],
		]);
		expect(getAvailableBulkSetBonuses(slots)).toEqual([setBonus(10, 2, 'Tier')]);
	});

	it('drops sets with fewer than two pieces, no name, or no id', () => {
		const slots: BulkSlotOptions = new Map([
			[BulkSimItemSlot.ItemSlotHead, [option(1, 10, 'Lonely'), option(2, 11, ''), option(3, 0, 'Unset'), option(4, 11, '')]],
		]);
		expect(getAvailableBulkSetBonuses(slots)).toEqual([]);
	});

	it('sorts by name, then by id for equal names', () => {
		const slots: BulkSlotOptions = new Map([
			[BulkSimItemSlot.ItemSlotHead, [option(1, 20, 'Bravery'), option(2, 20, 'Bravery'), option(3, 12, 'Bravery'), option(4, 12, 'Bravery')]],
			[BulkSimItemSlot.ItemSlotChest, [option(5, 5, 'Agony'), option(6, 5, 'Agony')]],
		]);
		expect(getAvailableBulkSetBonuses(slots).map(bonus => bonus.setId)).toEqual([5, 12, 20]);
	});
});

describe('pruneRequiredSetBonuses', () => {
	it('drops a requirement whose set is no longer offered', () => {
		expect(pruneRequiredSetBonuses(required([[10, 2]]), [setBonus(11, 4)])).toEqual([]);
	});

	it('drops a requirement asking for more pieces than the batch holds', () => {
		expect(pruneRequiredSetBonuses(required([[10, 4]]), [setBonus(10, 3)])).toEqual([]);
		expect(pruneRequiredSetBonuses(required([[10, 4]]), [setBonus(10, 4)])).toHaveLength(1);
	});

	it('sorts by set id, so the persisted blob does not churn on map order', () => {
		const bonuses = pruneRequiredSetBonuses(
			required([
				[30, 2],
				[10, 2],
				[20, 2],
			]),
			[setBonus(10, 2), setBonus(20, 2), setBonus(30, 2)],
		);
		expect(bonuses.map(bonus => bonus.setId)).toEqual([10, 20, 30]);
	});
});

describe('sanitiseRequiredSetBonuses', () => {
	it('lets a stored four-piece requirement discard everything else', () => {
		const sanitised = sanitiseRequiredSetBonuses([
			BulkRequiredSetBonus.create({ setId: 10, pieces: 2 }),
			BulkRequiredSetBonus.create({ setId: 11, pieces: 4 }),
		]);
		expect([...sanitised.keys()]).toEqual([11]);
	});

	it('keeps several two-piece requirements when no four-piece one is stored', () => {
		const sanitised = sanitiseRequiredSetBonuses([
			BulkRequiredSetBonus.create({ setId: 10, pieces: 2 }),
			BulkRequiredSetBonus.create({ setId: 11, pieces: 2 }),
		]);
		expect([...sanitised.keys()]).toEqual([10, 11]);
	});

	it('rejects piece counts that are not bonuses, and unset set ids', () => {
		const sanitised = sanitiseRequiredSetBonuses([
			BulkRequiredSetBonus.create({ setId: 10, pieces: 3 }),
			BulkRequiredSetBonus.create({ setId: 0, pieces: 2 }),
		]);
		expect(sanitised.size).toBe(0);
	});
});

describe('canEnableRequiredTwoPiece', () => {
	it('is true for the set already required at two pieces, without asking the solver', () => {
		expect(canEnableRequiredTwoPiece(required([[10, 2]]), 10, never)).toBe(true);
	});

	it('is false while a different set is required at four pieces', () => {
		expect(canEnableRequiredTwoPiece(required([[11, 4]]), 10, always)).toBe(false);
		expect(canEnableRequiredTwoPiece(required([[10, 4]]), 10, always)).toBe(true);
	});

	it('defers to the solver when nothing else blocks it', () => {
		expect(canEnableRequiredTwoPiece(required([]), 10, always)).toBe(true);
		expect(canEnableRequiredTwoPiece(required([]), 10, never)).toBe(false);
	});
});

describe('canEnableRequiredFourPiece', () => {
	it('needs four distinct pieces in the batch', () => {
		expect(canEnableRequiredFourPiece(required([]), setBonus(10, 3), always)).toBe(false);
		expect(canEnableRequiredFourPiece(required([]), setBonus(10, 4), always)).toBe(true);
	});

	it('is blocked by any other set required at two pieces', () => {
		expect(canEnableRequiredFourPiece(required([[11, 2]]), setBonus(10, 4), always)).toBe(false);
		expect(canEnableRequiredFourPiece(required([[10, 2]]), setBonus(10, 4), always)).toBe(true);
	});

	it('is true for the set already required at four pieces, whatever else says', () => {
		expect(
			canEnableRequiredFourPiece(
				required([
					[10, 4],
					[11, 2],
				]),
				setBonus(10, 2),
				never,
			),
		).toBe(true);
	});
});

describe('nextRequiredSetBonuses', () => {
	it('returns null when the requirement is already what was asked for', () => {
		expect(nextRequiredSetBonuses(required([[10, 2]]), setBonus(10, 4), 2, always)).toBeNull();
		expect(nextRequiredSetBonuses(required([]), setBonus(10, 4), 0, always)).toBeNull();
	});

	it('returns null when the request is refused', () => {
		expect(nextRequiredSetBonuses(required([]), setBonus(10, 4), 4, never)).toBeNull();
		expect(nextRequiredSetBonuses(required([]), setBonus(10, 2), 2, never)).toBeNull();
	});

	it('makes a four-piece requirement exclusive', () => {
		// Reachable only from a state that already allows it: a second set required at two pieces is
		// what `canEnableRequiredFourPiece` refuses outright, so the exclusivity shows on the set's
		// own upgrade from two to four.
		const next = nextRequiredSetBonuses(required([[10, 2]]), setBonus(10, 4), 4, always);
		expect(next && [...next.entries()].map(([setId, bonus]) => [setId, bonus.pieces])).toEqual([[10, 4]]);
		expect(nextRequiredSetBonuses(required([[11, 2]]), setBonus(10, 4), 4, always)).toBeNull();
	});

	it('leaves other two-piece requirements alone, and removes on zero', () => {
		const added = nextRequiredSetBonuses(required([[11, 2]]), setBonus(10, 2), 2, always);
		expect(added && [...added.keys()].sort()).toEqual([10, 11]);

		const removed = nextRequiredSetBonuses(
			required([
				[10, 2],
				[11, 2],
			]),
			setBonus(10, 2),
			0,
			always,
		);
		expect(removed && [...removed.keys()]).toEqual([11]);
	});

	it('does not mutate the map it was given', () => {
		const current = required([
			[10, 2],
			[11, 2],
		]);
		nextRequiredSetBonuses(current, setBonus(10, 2), 0, always);
		expect([...current.keys()]).toEqual([10, 11]);
	});
});

describe('hasMatchingRequiredSetBonusCombination', () => {
	const TIER = 10;
	const tierPiece = (id: number) => option(id, TIER, 'Tier');
	const filler = (id: number) => option(id);

	it('is true with nothing required', () => {
		expect(hasMatchingRequiredSetBonusCombination([], gearOf({}), new Map())).toBe(true);
	});

	it('is true when the worn gear already satisfies the requirement', () => {
		const gear = gearOf({ [ItemSlot.ItemSlotHead]: tierPiece(1), [ItemSlot.ItemSlotChest]: tierPiece(2) });
		expect(hasMatchingRequiredSetBonusCombination([BulkRequiredSetBonus.create({ setId: TIER, pieces: 2 })], gear, new Map())).toBe(true);
	});

	it('is true when a varying slot can bring the missing piece in', () => {
		const gear = gearOf({ [ItemSlot.ItemSlotHead]: tierPiece(1), [ItemSlot.ItemSlotChest]: filler(99) });
		const slots: BulkSlotOptions = new Map([[BulkSimItemSlot.ItemSlotChest, [filler(99), tierPiece(2)]]]);
		expect(hasMatchingRequiredSetBonusCombination([BulkRequiredSetBonus.create({ setId: TIER, pieces: 2 })], gear, slots)).toBe(true);
	});

	it('is false when no combination of the offered slots reaches the count', () => {
		const gear = gearOf({ [ItemSlot.ItemSlotHead]: filler(98), [ItemSlot.ItemSlotChest]: filler(99) });
		const slots: BulkSlotOptions = new Map([[BulkSimItemSlot.ItemSlotChest, [filler(99), tierPiece(2)]]]);
		expect(hasMatchingRequiredSetBonusCombination([BulkRequiredSetBonus.create({ setId: TIER, pieces: 2 })], gear, slots)).toBe(false);
	});

	it('ignores the weapon slots, whose choices the walk cannot attribute', () => {
		// One tier piece already worn and one on offer: an armour slot completes the requirement and
		// none of the paired slots may. Each is asserted on its own so that every entry in the
		// exclusion list has to earn its place — dropping any one of the five turns its line true.
		const gear = gearOf({ [ItemSlot.ItemSlotHead]: tierPiece(1) });
		const twoPieces = [BulkRequiredSetBonus.create({ setId: TIER, pieces: 2 })];
		const offering = (bulkSlot: BulkSimItemSlot): BulkSlotOptions => new Map([[bulkSlot, [tierPiece(2)]]]);

		expect(hasMatchingRequiredSetBonusCombination(twoPieces, gear, offering(BulkSimItemSlot.ItemSlotChest))).toBe(true);
		for (const excluded of [
			BulkSimItemSlot.ItemSlotMainHand,
			BulkSimItemSlot.ItemSlotOffHand,
			BulkSimItemSlot.ItemSlotHandWeapon,
			BulkSimItemSlot.ItemSlotFinger,
			BulkSimItemSlot.ItemSlotTrinket,
		]) {
			expect(hasMatchingRequiredSetBonusCombination(twoPieces, gear, offering(excluded))).toBe(false);
		}
	});

	it('clamps the worn count to what is asked for, so surplus pieces are not banked', () => {
		// Four tier pieces worn against a two-piece requirement start the walk at two, not four, and
		// two forced swaps then take it to zero. The batch cannot actually produce this — a slot's
		// options always include what is worn there, so the swaps are never forced — but the clamp is
		// what bounds the state space, and this is the input that tells it apart from no clamp at all.
		const gear = gearOf({
			[ItemSlot.ItemSlotHead]: tierPiece(1),
			[ItemSlot.ItemSlotChest]: tierPiece(2),
			[ItemSlot.ItemSlotLegs]: tierPiece(3),
			[ItemSlot.ItemSlotFeet]: tierPiece(4),
		});
		const forcedSwaps: BulkSlotOptions = new Map([
			[BulkSimItemSlot.ItemSlotHead, [filler(98)]],
			[BulkSimItemSlot.ItemSlotChest, [filler(99)]],
		]);
		expect(hasMatchingRequiredSetBonusCombination([BulkRequiredSetBonus.create({ setId: TIER, pieces: 2 })], gear, forcedSwaps)).toBe(false);
	});

	it('swapping a worn piece out counts against the requirement', () => {
		// Head holds the only tier piece worn and the batch offers nothing else for it, so choosing
		// the filler there is the only branch and it takes the count back below two.
		const gear = gearOf({ [ItemSlot.ItemSlotHead]: tierPiece(1), [ItemSlot.ItemSlotChest]: tierPiece(2) });
		const slots: BulkSlotOptions = new Map([[BulkSimItemSlot.ItemSlotHead, [filler(98)]]]);
		expect(hasMatchingRequiredSetBonusCombination([BulkRequiredSetBonus.create({ setId: TIER, pieces: 2 })], gear, slots)).toBe(false);
	});

	it('satisfies two sets at once only when both fit', () => {
		const OTHER = 11;
		const otherPiece = (id: number) => option(id, OTHER, 'Other');
		const gear = gearOf({ [ItemSlot.ItemSlotHead]: filler(98), [ItemSlot.ItemSlotChest]: filler(99) });
		const both = [BulkRequiredSetBonus.create({ setId: TIER, pieces: 2 }), BulkRequiredSetBonus.create({ setId: OTHER, pieces: 2 })];

		const fourSlots: BulkSlotOptions = new Map([
			[BulkSimItemSlot.ItemSlotHead, [tierPiece(1)]],
			[BulkSimItemSlot.ItemSlotChest, [tierPiece(2)]],
			[BulkSimItemSlot.ItemSlotLegs, [otherPiece(3)]],
			[BulkSimItemSlot.ItemSlotFeet, [otherPiece(4)]],
		]);
		expect(hasMatchingRequiredSetBonusCombination(both, gear, fourSlots)).toBe(true);

		const threeSlots: BulkSlotOptions = new Map([
			[BulkSimItemSlot.ItemSlotHead, [tierPiece(1)]],
			[BulkSimItemSlot.ItemSlotChest, [tierPiece(2)]],
			[BulkSimItemSlot.ItemSlotLegs, [otherPiece(3)]],
		]);
		expect(hasMatchingRequiredSetBonusCombination(both, gear, threeSlots)).toBe(false);
	});

	it('does not let one set overcount for another: the clamp is per set', () => {
		// Six tier slots and a two-piece requirement: the surplus must not spill into the second
		// set's count, which is what a shared counter would do.
		const OTHER = 11;
		const gear = gearOf({});
		const slots: BulkSlotOptions = new Map([
			[BulkSimItemSlot.ItemSlotHead, [tierPiece(1)]],
			[BulkSimItemSlot.ItemSlotChest, [tierPiece(2)]],
			[BulkSimItemSlot.ItemSlotLegs, [tierPiece(3)]],
			[BulkSimItemSlot.ItemSlotFeet, [tierPiece(4)]],
		]);
		const both = [BulkRequiredSetBonus.create({ setId: TIER, pieces: 2 }), BulkRequiredSetBonus.create({ setId: OTHER, pieces: 2 })];
		expect(hasMatchingRequiredSetBonusCombination(both, gear, slots)).toBe(false);
		expect(hasMatchingRequiredSetBonusCombination([both[0]], gear, slots)).toBe(true);
	});
});
