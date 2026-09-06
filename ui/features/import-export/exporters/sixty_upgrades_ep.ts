import { UnitStat } from '@domain/proto_utils/stats';
import { PseudoStat, Stat } from '@generated/proto/common';

import type { ExporterDefinition } from './types';

const STAT_NAMES: Record<Stat, string> = {
	[Stat.StatStrength]: 'strength',
	[Stat.StatAgility]: 'agility',
	[Stat.StatStamina]: 'stamina',
	[Stat.StatIntellect]: 'intellect',
	[Stat.StatSpirit]: 'spirit',
	[Stat.StatSpellPower]: 'spellDamage',
	[Stat.StatMP5]: 'mp5',
	[Stat.StatHitRating]: 'hitRating',
	[Stat.StatCritRating]: 'critRating',
	[Stat.StatHasteRating]: 'hasteRating',
	[Stat.StatAttackPower]: 'attackPower',
	[Stat.StatMasteryRating]: 'masteryRating',
	[Stat.StatExpertiseRating]: 'expertiseRating',
	// TODO: Change PVP Resilience and Power once 60U exists for MoP
	[Stat.StatPvpResilienceRating]: 'pvpResilienceRating',
	[Stat.StatPvpPowerRating]: 'pvpPowerRating',
	[Stat.StatMana]: 'mana',
	[Stat.StatArmor]: 'armor',
	[Stat.StatRangedAttackPower]: 'attackPower',
	[Stat.StatDodgeRating]: 'dodgeRating',
	[Stat.StatParryRating]: 'parryRating',
	[Stat.StatHealth]: 'health',
	[Stat.StatBonusArmor]: 'armorBonus',
};

const PSEUDO_STAT_NAMES: Partial<Record<PseudoStat, string>> = {
	[PseudoStat.PseudoStatMainHandDps]: 'dps',
	[PseudoStat.PseudoStatRangedDps]: 'rangedDps',
};

const getName = (stat: UnitStat): string => (stat.isStat() ? STAT_NAMES[stat.getStat()] : (PSEUDO_STAT_NAMES[stat.getPseudoStat()] ?? ''));

export const SIXTY_UPGRADES_EP_EXPORTER: ExporterDefinition = {
	title: 'Sixty Upgrades Cataclysm EP Export',
	allowDownload: true,
	getData: host => {
		const player = host.player;
		const epValues = player.getEpWeights();
		const allUnitStats = UnitStat.getAll();

		const namesToWeights: Record<string, number> = {};
		allUnitStats.forEach(stat => {
			const statName = getName(stat);
			const weight = epValues.getUnitStat(stat);
			if (weight == 0 || statName == '') {
				return;
			}

			// Need to add together stats with the same name (e.g. hit/crit/haste).
			if (namesToWeights[statName]) {
				namesToWeights[statName] += weight;
			} else {
				namesToWeights[statName] = weight;
			}
		});

		return (
			`https://sixtyupgrades.com/mop/ep/import?name=${encodeURIComponent(`${player.getPlayerSpec().friendlyName} WoWSims Weights`)}` +
			Object.keys(namesToWeights)
				.map(statName => `&${statName}=${namesToWeights[statName].toFixed(3)}`)
				.join('')
		);
	},
};
