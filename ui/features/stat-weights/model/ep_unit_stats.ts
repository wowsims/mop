import { UnitStat } from '@domain/proto_utils/stats';
import { PseudoStat, Stat } from '@generated/proto/common';

export type EpStatSet = {
	epStats: Stat[];
	epPseudoStats: PseudoStat[];
};

const EP_PSEUDO_STATS = [
	PseudoStat.PseudoStatMainHandDps,
	PseudoStat.PseudoStatOffHandDps,
	PseudoStat.PseudoStatRangedDps,
	PseudoStat.PseudoStatPhysicalHitPercent,
	PseudoStat.PseudoStatSpellHitPercent,
	PseudoStat.PseudoStatPhysicalCritPercent,
	PseudoStat.PseudoStatSpellCritPercent,
];

export const EP_UNIT_STATS: UnitStat[] = UnitStat.getAll().filter(stat => {
	if (stat.isStat()) {
		return true;
	} else {
		return EP_PSEUDO_STATS.includes(stat.getPseudoStat());
	}
});

export const isEpStat = (stat: UnitStat, { epStats, epPseudoStats }: EpStatSet): boolean => {
	if (stat.isStat()) return epStats.includes(stat.getStat());
	return epPseudoStats.includes(stat.getPseudoStat());
};

export const visibleEpUnitStats = (statSet: EpStatSet, showAllStats: boolean): UnitStat[] =>
	EP_UNIT_STATS.filter(stat => showAllStats || isEpStat(stat, statSet));
