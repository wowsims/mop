import { LaunchStatus } from '../core/launched_sims';
import { Class, PseudoStat, Spec, Stat } from '../core/proto/common';
import i18n from './config';

export const statI18nKeys: Record<Stat, string> = {
	[Stat.StatStrength]: 'strength',
	[Stat.StatAgility]: 'agility',
	[Stat.StatStamina]: 'stamina',
	[Stat.StatIntellect]: 'intellect',
	[Stat.StatSpirit]: 'spirit',
	[Stat.StatHitRating]: 'spell_hit',
	[Stat.StatCritRating]: 'spell_crit',
	[Stat.StatHasteRating]: 'spell_haste',
	[Stat.StatExpertiseRating]: 'expertise',
	[Stat.StatDodgeRating]: 'dodge',
	[Stat.StatParryRating]: 'parry',
	[Stat.StatMasteryRating]: 'mastery',
	[Stat.StatAttackPower]: 'attack_power',
	[Stat.StatRangedAttackPower]: 'ranged_attack_power',
	[Stat.StatSpellPower]: 'spell_power',
	[Stat.StatPvpResilienceRating]: 'pvp_resilience',
	[Stat.StatPvpPowerRating]: 'pvp_power',
	[Stat.StatArmor]: 'armor',
	[Stat.StatBonusArmor]: 'bonus_armor',
	[Stat.StatHealth]: 'health',
	[Stat.StatMana]: 'mana',
	[Stat.StatMP5]: 'mp5',
};

export const pseudoStatI18nKeys: Record<PseudoStat, string> = {
	[PseudoStat.PseudoStatMainHandDps]: 'main_hand_dps',
	[PseudoStat.PseudoStatOffHandDps]: 'off_hand_dps',
	[PseudoStat.PseudoStatRangedDps]: 'ranged_dps',
	[PseudoStat.PseudoStatDodgePercent]: 'dodge',
	[PseudoStat.PseudoStatParryPercent]: 'parry',
	[PseudoStat.PseudoStatBlockPercent]: 'block',
	[PseudoStat.PseudoStatMeleeSpeedMultiplier]: 'melee_speed_multiplier',
	[PseudoStat.PseudoStatRangedSpeedMultiplier]: 'ranged_speed_multiplier',
	[PseudoStat.PseudoStatCastSpeedMultiplier]: 'cast_speed_multiplier',
	[PseudoStat.PseudoStatMeleeHastePercent]: 'melee_haste',
	[PseudoStat.PseudoStatRangedHastePercent]: 'ranged_haste',
	[PseudoStat.PseudoStatSpellHastePercent]: 'spell_haste',
	[PseudoStat.PseudoStatPhysicalHitPercent]: 'melee_hit',
	[PseudoStat.PseudoStatSpellHitPercent]: 'spell_hit',
	[PseudoStat.PseudoStatPhysicalCritPercent]: 'melee_crit',
	[PseudoStat.PseudoStatSpellCritPercent]: 'spell_crit',
};

export const classI18nKeys: Record<Class, string> = {
	[Class.ClassUnknown]: 'unknown',
	[Class.ClassWarrior]: 'warrior',
	[Class.ClassPaladin]: 'paladin',
	[Class.ClassHunter]: 'hunter',
	[Class.ClassRogue]: 'rogue',
	[Class.ClassPriest]: 'priest',
	[Class.ClassDeathKnight]: 'death_knight',
	[Class.ClassShaman]: 'shaman',
	[Class.ClassMage]: 'mage',
	[Class.ClassWarlock]: 'warlock',
	[Class.ClassMonk]: 'monk',
	[Class.ClassDruid]: 'druid',
	[Class.ClassExtra1]: 'extra1',
	[Class.ClassExtra2]: 'extra2',
	[Class.ClassExtra3]: 'extra3',
	[Class.ClassExtra4]: 'extra4',
	[Class.ClassExtra5]: 'extra5',
	[Class.ClassExtra6]: 'extra6',
};

export const specI18nKeys: Record<Spec, string> = {
	[Spec.SpecUnknown]: 'unknown',
	// Death Knight
	[Spec.SpecBloodDeathKnight]: 'blood',
	[Spec.SpecFrostDeathKnight]: 'frost',
	[Spec.SpecUnholyDeathKnight]: 'unholy',
	// Druid
	[Spec.SpecBalanceDruid]: 'balance',
	[Spec.SpecFeralDruid]: 'feral',
	[Spec.SpecGuardianDruid]: 'guardian',
	[Spec.SpecRestorationDruid]: 'restoration',
	// Hunter
	[Spec.SpecBeastMasteryHunter]: 'beast_mastery',
	[Spec.SpecMarksmanshipHunter]: 'marksmanship',
	[Spec.SpecSurvivalHunter]: 'survival',
	// Mage
	[Spec.SpecArcaneMage]: 'arcane',
	[Spec.SpecFireMage]: 'fire',
	[Spec.SpecFrostMage]: 'frost',
	// Monk
	[Spec.SpecBrewmasterMonk]: 'brewmaster',
	[Spec.SpecMistweaverMonk]: 'mistweaver',
	[Spec.SpecWindwalkerMonk]: 'windwalker',
	// Paladin
	[Spec.SpecHolyPaladin]: 'holy',
	[Spec.SpecProtectionPaladin]: 'protection',
	[Spec.SpecRetributionPaladin]: 'retribution',
	// Priest
	[Spec.SpecDisciplinePriest]: 'discipline',
	[Spec.SpecHolyPriest]: 'holy',
	[Spec.SpecShadowPriest]: 'shadow',
	// Rogue
	[Spec.SpecAssassinationRogue]: 'assassination',
	[Spec.SpecCombatRogue]: 'combat',
	[Spec.SpecSubtletyRogue]: 'subtlety',
	// Shaman
	[Spec.SpecElementalShaman]: 'elemental',
	[Spec.SpecEnhancementShaman]: 'enhancement',
	[Spec.SpecRestorationShaman]: 'restoration',
	// Warlock
	[Spec.SpecAfflictionWarlock]: 'affliction',
	[Spec.SpecDemonologyWarlock]: 'demonology',
	[Spec.SpecDestructionWarlock]: 'destruction',
	// Warrior
	[Spec.SpecArmsWarrior]: 'arms',
	[Spec.SpecFuryWarrior]: 'fury',
	[Spec.SpecProtectionWarrior]: 'protection',
};

export const statusI18nKeys: Record<LaunchStatus, string> = {
	[LaunchStatus.Unlaunched]: 'unlaunched',
	[LaunchStatus.Alpha]: 'alpha',
	[LaunchStatus.Beta]: 'beta',
	[LaunchStatus.Launched]: 'launched',
};

export const translateStat = (stat: Stat): string => {
	const key = statI18nKeys[stat] || Stat[stat].toLowerCase();
	return i18n.t(`common.stats.${key}`);
};

export const translatePseudoStat = (pseudoStat: PseudoStat): string => {
	const key = pseudoStatI18nKeys[pseudoStat] || PseudoStat[pseudoStat].toLowerCase();
	return i18n.t(`common.stats.${key}`);
};

export const translateClassEnum = (classID: Class): string => {
	const key = getClassI18nKey(classID);
	return i18n.t(`common.classes.${key}`);
};

export const translateSpecEnum = (specID: Spec): string => {
	const key = getSpecI18nKey(specID);
	return i18n.t(`common.specs.${key}`);
};

export const translateStatus = (status: LaunchStatus): string => {
	const key = getStatusI18nKey(status);
	return i18n.t(`common.status.${key}`);
};

export function getClassI18nKey(classID: Class): string {
	return classI18nKeys[classID] || Class[classID].toLowerCase();
}

export function getSpecI18nKey(specID: Spec): string {
	return specI18nKeys[specID] || Spec[specID].toLowerCase();
}

export function getStatusI18nKey(status: LaunchStatus): string {
	return statusI18nKeys[status] || LaunchStatus[status].toLowerCase();
}
