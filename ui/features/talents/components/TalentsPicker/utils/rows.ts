import type { TalentConfig } from '@domain/talents/config';

export const buildTalentRows = <TalentsProto>(talents: ReadonlyArray<TalentConfig<TalentsProto>>): Array<Array<TalentConfig<TalentsProto>>> =>
	talents.reduce<Array<Array<TalentConfig<TalentsProto>>>>((rows, talent) => {
		if (!rows[talent.location.rowIdx]) rows[talent.location.rowIdx] = [];
		rows[talent.location.rowIdx][talent.location.colIdx] = talent;
		return rows;
	}, []);
