import type { TalentConfig } from '@domain/talents/config';

/**
 * The tree's talents bucketed by `location`, the way the vanilla reduce did it: indexed by row and
 * then by column, so the grid comes from the data rather than from the order the config lists it in.
 */
export const buildTalentRows = <TalentsProto>(talents: ReadonlyArray<TalentConfig<TalentsProto>>): Array<Array<TalentConfig<TalentsProto>>> =>
	talents.reduce<Array<Array<TalentConfig<TalentsProto>>>>((rows, talent) => {
		if (!rows[talent.location.rowIdx]) rows[talent.location.rowIdx] = [];
		rows[talent.location.rowIdx][talent.location.colIdx] = talent;
		return rows;
	}, []);
