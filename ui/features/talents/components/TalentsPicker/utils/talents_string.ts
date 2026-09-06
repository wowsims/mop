import type { TalentLocation } from '@domain/talents/config';

/** MoP trees are six rows of three, and the vanilla picker hardcodes the six: `getTalentsString()` builds `Array.from(Array(6), …)` whatever the config holds. */
export const TALENT_ROWS = 6;

export const selectedColumn = (talentsString: string, rowIdx: number): number => {
	const digit = Number(talentsString[rowIdx]);
	// A short string or a non-digit reads as unspent, which is what comparing against NaN did.
	return Number.isInteger(digit) && digit > 0 ? digit - 1 : -1;
};

const withRow = (talentsString: string, rowIdx: number, colIdx: number): string =>
	Array.from({ length: TALENT_ROWS }, (_, row) => (row === rowIdx ? colIdx : selectedColumn(talentsString, row)) + 1).join('');

export const withTalentSelected = (talentsString: string, location: TalentLocation): string => withRow(talentsString, location.rowIdx, location.colIdx);

export const withTalentCleared = (talentsString: string, location: TalentLocation): string => {
	const spent = selectedColumn(talentsString, location.rowIdx);
	return withRow(talentsString, location.rowIdx, spent === location.colIdx ? -1 : spent);
};

export const clearedTalentsString = (): string => '0'.repeat(TALENT_ROWS);
