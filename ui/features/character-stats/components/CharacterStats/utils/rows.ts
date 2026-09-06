import { Player } from '@domain/player';
import { UnitStat } from '@domain/proto_utils/stats';
import { PseudoStat, Stat } from '@generated/proto/common';

import { shouldShowMeleeCritCap } from './stat_display';

export enum StatGroup {
	Primary = 'Primary',
	Attributes = 'Attributes',
	Physical = 'Physical',
	Spell = 'Spell',
	Defense = 'Defense',
}

export type Row = { kind: 'stat'; id: string; unitStat: UnitStat } | { kind: 'crit-cap'; id: string };

export interface RowGroup {
	key: StatGroup;
	rows: Row[];
}

const defaultGroups = (): Map<StatGroup, Array<UnitStat>> =>
	new Map<StatGroup, Array<UnitStat>>([
		[StatGroup.Primary, [UnitStat.fromStat(Stat.StatHealth), UnitStat.fromStat(Stat.StatMana)]],
		[
			StatGroup.Attributes,
			[
				UnitStat.fromStat(Stat.StatStrength),
				UnitStat.fromStat(Stat.StatAgility),
				UnitStat.fromStat(Stat.StatStamina),
				UnitStat.fromStat(Stat.StatIntellect),
				UnitStat.fromStat(Stat.StatSpirit),
				UnitStat.fromStat(Stat.StatPvpPowerRating),
				UnitStat.fromStat(Stat.StatPvpResilienceRating),
			],
		],
		[
			StatGroup.Defense,
			[
				UnitStat.fromStat(Stat.StatArmor),
				UnitStat.fromStat(Stat.StatBonusArmor),
				UnitStat.fromPseudoStat(PseudoStat.PseudoStatDodgePercent),
				UnitStat.fromPseudoStat(PseudoStat.PseudoStatParryPercent),
				UnitStat.fromPseudoStat(PseudoStat.PseudoStatBlockPercent),
			],
		],
		[
			StatGroup.Physical,
			[
				UnitStat.fromStat(Stat.StatAttackPower),
				UnitStat.fromStat(Stat.StatRangedAttackPower),
				UnitStat.fromPseudoStat(PseudoStat.PseudoStatMeleeHastePercent),
				UnitStat.fromPseudoStat(PseudoStat.PseudoStatRangedHastePercent),
				UnitStat.fromPseudoStat(PseudoStat.PseudoStatPhysicalHitPercent),
				UnitStat.fromPseudoStat(PseudoStat.PseudoStatPhysicalCritPercent),
			],
		],
		[
			StatGroup.Spell,
			[
				UnitStat.fromStat(Stat.StatSpellPower),
				UnitStat.fromPseudoStat(PseudoStat.PseudoStatSpellHastePercent),
				UnitStat.fromPseudoStat(PseudoStat.PseudoStatSpellHitPercent),
				UnitStat.fromPseudoStat(PseudoStat.PseudoStatSpellCritPercent),
			],
		],
	]);

// Expertise sits next to whichever hit the spec cares about, and mastery at the end of that same group — except for tanks, where mastery is a defensive stat.
const placeExpertiseAndMastery = (groups: Map<StatGroup, Array<UnitStat>>, player: Player<any>, epReferenceStat: Stat) => {
	const after = (group: StatGroup, hit: PseudoStat) => {
		const stats = groups.get(group)!;
		stats.splice(stats.findIndex(stat => stat.equalsPseudoStat(hit)) + 1, 0, UnitStat.fromStat(Stat.StatExpertiseRating));
		return stats;
	};

	if (player.getPlayerSpec().isTankSpec) {
		after(StatGroup.Physical, PseudoStat.PseudoStatPhysicalHitPercent);
		groups.get(StatGroup.Defense)!.push(UnitStat.fromStat(Stat.StatMasteryRating));
	} else if ([Stat.StatIntellect, Stat.StatSpellPower].includes(epReferenceStat)) {
		after(StatGroup.Spell, PseudoStat.PseudoStatSpellHitPercent).push(UnitStat.fromStat(Stat.StatMasteryRating));
	} else {
		after(StatGroup.Physical, PseudoStat.PseudoStatPhysicalHitPercent).push(UnitStat.fromStat(Stat.StatMasteryRating));
	}
};

export const buildRows = (player: Player<any>, statList: Array<UnitStat>, epReferenceStat: Stat): RowGroup[] => {
	const groups = defaultGroups();
	placeExpertiseAndMastery(groups, player, epReferenceStat);
	const showCritCap = shouldShowMeleeCritCap(player);

	const result: RowGroup[] = [];
	groups.forEach((groupedStats, key) => {
		const filtered = groupedStats.filter(stat => statList.find(listStat => listStat.equals(stat)));
		if (!filtered.length) return;
		// Mastery lands in both Physical and Spell for some specs; a group holding only it is the one the spec does not care about.
		if ([StatGroup.Physical, StatGroup.Spell].includes(key) && filtered.length === 1) return;

		const rows: Row[] = [];
		filtered.forEach(unitStat => {
			const id = `${key}-${unitStat.isStat() ? `stat-${unitStat.getStat()}` : `pseudo-${unitStat.getPseudoStat()}`}`;
			rows.push({ kind: 'stat', id, unitStat });
			if (unitStat.isPseudoStat() && unitStat.getPseudoStat() === PseudoStat.PseudoStatPhysicalCritPercent && showCritCap) {
				rows.push({ kind: 'crit-cap', id: `${id}-crit-cap` });
			}
		});
		result.push({ key, rows });
	});
	return result;
};
