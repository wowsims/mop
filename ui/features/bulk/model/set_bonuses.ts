import { BulkRequiredSetBonus } from '@generated/proto/api';
import type { ItemSlot } from '@generated/proto/common';
// From the generated module rather than the `@sim/bulk/utils` re-export, which is in a cycle:
// `utils` pulls in `@sim/proto/items`, which reaches `@i18n/entity_mapping`, which reads
// `BulkSimItemSlot` off `utils` at module scope. Entering that ring here leaves the enum
// `undefined`. `constants_auto_gen` depends on the generated protos and nothing else.
import { BULK_SIM_ITEM_SLOT_TO_SINGLE_ITEM_SLOT, BulkSimItemSlot } from '@sim/bulk/constants_auto_gen';
import type { EquippedItem } from '@sim/proto/equipped_item';
import type { Gear } from '@sim/proto/gear';

export interface BulkSetBonusOption {
	setId: number;
	setName: string;
	totalPieces: number;
}

/** Every item the batch can put in each bulk slot, the equipped ones included. */
export type BulkSlotOptions = ReadonlyMap<BulkSimItemSlot, EquippedItem[]>;

/**
 * Slots a candidate gear set is free to vary one piece at a time. The five left out map to two
 * physical slots each, so a single choice there is not one substitution and the counting below
 * would be wrong.
 */
const SINGLE_PIECE_EXCLUDED_SLOTS = [
	BulkSimItemSlot.ItemSlotMainHand,
	BulkSimItemSlot.ItemSlotOffHand,
	BulkSimItemSlot.ItemSlotHandWeapon,
	BulkSimItemSlot.ItemSlotFinger,
	BulkSimItemSlot.ItemSlotTrinket,
];

/**
 * The set bonuses the batch could actually reach, by set. Counted by distinct item id rather than by
 * picker, so two ilvl tiers of one piece are one piece; a set with fewer than two of them cannot
 * grant a bonus and is left out entirely.
 */
export const getAvailableBulkSetBonuses = (slotOptions: BulkSlotOptions): BulkSetBonusOption[] => {
	const setBonuses = new Map<number, BulkSetBonusOption & { itemIds: Set<number> }>();

	for (const options of slotOptions.values()) {
		for (const option of options) {
			const item = option.item;
			if (!item.setId || !item.setName) continue;

			if (!setBonuses.has(item.setId)) {
				setBonuses.set(item.setId, { setId: item.setId, setName: item.setName, totalPieces: 0, itemIds: new Set<number>() });
			}
			setBonuses.get(item.setId)!.itemIds.add(item.id);
		}
	}

	return Array.from(setBonuses.values())
		.map(setBonus => ({ setId: setBonus.setId, setName: setBonus.setName, totalPieces: setBonus.itemIds.size }))
		.filter(setBonus => setBonus.setName && setBonus.totalPieces >= 2)
		.sort((a, b) => a.setName.localeCompare(b.setName) || a.setId - b.setId);
};

/**
 * What gets persisted: the required bonuses that are still reachable. A set the batch has since
 * lost pieces of — or lost entirely — would otherwise be saved and reloaded as an unsatisfiable
 * requirement, and every candidate would be rejected with nothing on screen to say why.
 */
export const pruneRequiredSetBonuses = (
	requiredSetBonuses: ReadonlyMap<number, BulkRequiredSetBonus>,
	available: readonly BulkSetBonusOption[],
): BulkRequiredSetBonus[] => {
	const setBonusesById = new Map(available.map(setBonus => [setBonus.setId, setBonus]));
	return Array.from(requiredSetBonuses.values())
		.map(requiredSetBonus => {
			const setBonus = setBonusesById.get(requiredSetBonus.setId);
			if (!setBonus || requiredSetBonus.pieces > setBonus.totalPieces) return null;
			return BulkRequiredSetBonus.create(requiredSetBonus);
		})
		.filter((requiredSetBonus): requiredSetBonus is BulkRequiredSetBonus => requiredSetBonus !== null)
		.sort((a, b) => a.setId - b.setId);
};

/**
 * What a persisted blob is allowed to restore. Only 2 and 4 are bonuses, and a four-piece
 * requirement is exclusive — so one of those in the blob discards everything else rather than being
 * loaded alongside a second set it can never be worn with.
 */
export const sanitiseRequiredSetBonuses = (requiredSetBonuses: readonly BulkRequiredSetBonus[]): Map<number, BulkRequiredSetBonus> => {
	const requiredFourPieceSetBonus = requiredSetBonuses.find(requiredSetBonus => requiredSetBonus.setId > 0 && requiredSetBonus.pieces === 4);
	const toStore = requiredFourPieceSetBonus ? [requiredFourPieceSetBonus] : requiredSetBonuses;

	const sanitised = new Map<number, BulkRequiredSetBonus>();
	for (const requiredSetBonus of toStore) {
		if (requiredSetBonus.setId > 0 && [2, 4].includes(requiredSetBonus.pieces)) {
			sanitised.set(requiredSetBonus.setId, BulkRequiredSetBonus.create(requiredSetBonus));
		}
	}
	return sanitised;
};

const getRequiredFourPieceSetBonusId = (requiredSetBonuses: ReadonlyMap<number, BulkRequiredSetBonus>): number | undefined =>
	Array.from(requiredSetBonuses.entries()).find(([, requiredSetBonus]) => requiredSetBonus.pieces === 4)?.[0];

const hasOtherRequiredSetBonus = (requiredSetBonuses: ReadonlyMap<number, BulkRequiredSetBonus>, setId: number, pieces?: number): boolean =>
	Array.from(requiredSetBonuses.entries()).some(
		([requiredSetBonusId, requiredSetBonus]) => requiredSetBonusId !== setId && (pieces === undefined || requiredSetBonus.pieces === pieces),
	);

/** Answers `canSatisfyRequiredSetBonus`, which the caller memoises against its own change counter. */
export type CanSatisfySetBonus = (setId: number, pieces: number) => boolean;

export const canEnableRequiredTwoPiece = (
	requiredSetBonuses: ReadonlyMap<number, BulkRequiredSetBonus>,
	setId: number,
	canSatisfy: CanSatisfySetBonus,
): boolean => {
	if (requiredSetBonuses.get(setId)?.pieces === 2) return true;

	const fourPieceSetBonusId = getRequiredFourPieceSetBonusId(requiredSetBonuses);
	return (fourPieceSetBonusId === undefined || fourPieceSetBonusId === setId) && canSatisfy(setId, 2);
};

export const canEnableRequiredFourPiece = (
	requiredSetBonuses: ReadonlyMap<number, BulkRequiredSetBonus>,
	setBonus: BulkSetBonusOption,
	canSatisfy: CanSatisfySetBonus,
): boolean => {
	if (requiredSetBonuses.get(setBonus.setId)?.pieces === 4) return true;

	const fourPieceSetBonusId = getRequiredFourPieceSetBonusId(requiredSetBonuses);
	return (
		setBonus.totalPieces >= 4 &&
		(fourPieceSetBonusId === undefined || fourPieceSetBonusId === setBonus.setId) &&
		!hasOtherRequiredSetBonus(requiredSetBonuses, setBonus.setId, 2) &&
		canSatisfy(setBonus.setId, 4)
	);
};

/**
 * The map after asking for `pieces` of `setBonus`, or `null` when the request is a no-op or is
 * refused. Four pieces is exclusive and clears the rest; zero removes the requirement.
 */
export const nextRequiredSetBonuses = (
	requiredSetBonuses: ReadonlyMap<number, BulkRequiredSetBonus>,
	setBonus: BulkSetBonusOption,
	pieces: number,
	canSatisfy: CanSatisfySetBonus,
): Map<number, BulkRequiredSetBonus> | null => {
	if ((requiredSetBonuses.get(setBonus.setId)?.pieces ?? 0) === pieces) return null;

	if (pieces === 4) {
		if (!canEnableRequiredFourPiece(requiredSetBonuses, setBonus, canSatisfy)) return null;
		return new Map([[setBonus.setId, BulkRequiredSetBonus.create({ setId: setBonus.setId, pieces })]]);
	}

	const next = new Map(requiredSetBonuses);
	if (pieces === 2) {
		if (!canEnableRequiredTwoPiece(requiredSetBonuses, setBonus.setId, canSatisfy)) return null;
		next.set(setBonus.setId, BulkRequiredSetBonus.create({ setId: setBonus.setId, pieces }));
	} else {
		next.delete(setBonus.setId);
	}
	return next;
};

const addItemToCounts = (counts: number[], indexes: ReadonlyMap<number, number>, equippedItem: EquippedItem | null, delta: number) => {
	const item = equippedItem?.item;
	if (!item?.setId) return;

	const index = indexes.get(item.setId);
	if (index === undefined) return;

	counts[index] += delta;
};

const optionDeltas = (baseGear: Gear, indexes: ReadonlyMap<number, number>, slot: ItemSlot, option: EquippedItem | null): number[] => {
	const deltas = new Array<number>(indexes.size).fill(0);
	addItemToCounts(deltas, indexes, baseGear.getEquippedItem(slot), -1);
	addItemToCounts(deltas, indexes, option, 1);
	return deltas;
};

/**
 * Whether some combination of the batch's per-slot options reaches every required set bonus at once.
 *
 * A reachability question rather than a search: each varying slot contributes one dimension of
 * per-set deltas, and the walk carries forward the distinct piece-count vectors reachable so far,
 * clamped to what each requirement asks for. Clamping is what keeps the state space small — a
 * five-piece set asked for four pieces has one state, not five — and it is sound because no bonus
 * counts beyond its own threshold.
 *
 * A slot with nothing in it contributes no dimension at all rather than failing: the batch simply
 * keeps whatever is worn there. Two guards in the original were unreachable — a slot cannot both be
 * kept and be empty, and the carried state set can never shrink to nothing — and are gone.
 */
export const hasMatchingRequiredSetBonusCombination = (
	requiredSetBonuses: readonly BulkRequiredSetBonus[],
	baseGear: Gear,
	slotOptions: BulkSlotOptions,
): boolean => {
	if (!requiredSetBonuses.length) return true;

	const indexes = new Map<number, number>();
	requiredSetBonuses.forEach((requiredSetBonus, index) => indexes.set(requiredSetBonus.setId, index));

	const requiredPieces = requiredSetBonuses.map(requiredSetBonus => requiredSetBonus.pieces);
	const baseCounts = new Array<number>(requiredSetBonuses.length).fill(0);
	baseGear.getEquippedItems().forEach(equippedItem => addItemToCounts(baseCounts, indexes, equippedItem, 1));

	const clampCounts = (counts: number[]) => counts.map((count, index) => Math.min(requiredPieces[index], Math.max(0, count)));
	let states = new Map<string, number[]>();
	const initialState = clampCounts(baseCounts);
	states.set(initialState.join(','), initialState);

	for (const [bulkItemSlot, options] of slotOptions.entries()) {
		if (!options.length || SINGLE_PIECE_EXCLUDED_SLOTS.includes(bulkItemSlot)) continue;

		// Per option, not per state times option: the deltas depend on the slot and the option only.
		const slot = BULK_SIM_ITEM_SLOT_TO_SINGLE_ITEM_SLOT.get(bulkItemSlot)!;
		const deltasPerOption = options.map(option => optionDeltas(baseGear, indexes, slot, option));

		const nextStates = new Map<string, number[]>();
		for (const counts of states.values()) {
			for (const deltas of deltasPerOption) {
				const nextCounts = clampCounts(counts.map((count, index) => count + deltas[index]));
				nextStates.set(nextCounts.join(','), nextCounts);
			}
		}
		states = nextStates;
	}

	for (const counts of states.values()) {
		if (counts.every((count, index) => count >= requiredPieces[index])) return true;
	}

	return false;
};
