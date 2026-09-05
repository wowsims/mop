import type { TalentLocation } from '@domain/talents/config';

/**
 * MoP trees are six rows of three, and the vanilla picker hardcodes the six: `getTalentsString()`
 * builds `Array.from(Array(6), …)` whatever the config holds. The string is positional — one digit
 * per row, `0` for an unspent row and otherwise the 1-based column.
 *
 * The vanilla picker's model was the DOM (`data-selected` on each anchor) with the string derived
 * from it on every write; here the string *is* the model and the selection is derived, which is why
 * these are pure functions over it rather than methods on a tree.
 */
export const TALENT_ROWS = 6;

/** The column spent in `rowIdx`, or -1 for none — vanilla's `str.split('').map(Number)` per row. */
export const selectedColumn = (talentsString: string, rowIdx: number): number => {
	const digit = Number(talentsString[rowIdx]);
	// A short string or a non-digit reads as unspent, which is what comparing against NaN did.
	return Number.isInteger(digit) && digit > 0 ? digit - 1 : -1;
};

/** The six-digit string `getTalentsString()` would produce, with one row overridden. -1 clears it. */
const withRow = (talentsString: string, rowIdx: number, colIdx: number): string =>
	Array.from({ length: TALENT_ROWS }, (_, row) => (row === rowIdx ? colIdx : selectedColumn(talentsString, row)) + 1).join('');

/** Left click, and the short tap: `setSelected(true)` drops whatever else the row held. */
export const withTalentSelected = (talentsString: string, location: TalentLocation): string => withRow(talentsString, location.rowIdx, location.colIdx);

/**
 * Right click, and the long press: `setSelected(false)` clears *this* talent only, so a row whose
 * point sits on a different talent keeps it. The string is still rewritten either way, because
 * `inputChanged()` writes unconditionally — which is also what fires the tab's analytics event.
 */
export const withTalentCleared = (talentsString: string, location: TalentLocation): string => {
	const spent = selectedColumn(talentsString, location.rowIdx);
	return withRow(talentsString, location.rowIdx, spent === location.colIdx ? -1 : spent);
};

/** The reset button: `resetPoints()` deselects every row and writes the result. */
export const clearedTalentsString = (): string => '0'.repeat(TALENT_ROWS);
