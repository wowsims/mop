import { Class, PseudoStat, Spec,Stat } from '../core/proto/common';
import i18n from './config';

// Stat and PseudoStat mappings
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

export function getStatI18nKey(stat: Stat): string {
  return statI18nKeys[stat] || Stat[stat].toLowerCase();
}

export function getPseudoStatI18nKey(pseudoStat: PseudoStat): string {
  return pseudoStatI18nKeys[pseudoStat] || PseudoStat[pseudoStat].toLowerCase();
}

export const translateStat = (stat: Stat): string => {
  const key = getStatI18nKey(stat);
  return i18n.t(`common.stats.${key}`);
};

export const translatePseudoStat = (pseudoStat: PseudoStat): string => {
  const key = getPseudoStatI18nKey(pseudoStat);
  return i18n.t(`common.stats.${key}`);
};

// Class and Spec translation logic
export const classEnumToString = (classID: Class): string => {
  switch (classID) {
    case Class.ClassDeathKnight: return 'death_knight';
    case Class.ClassDruid: return 'druid';
    case Class.ClassHunter: return 'hunter';
    case Class.ClassMage: return 'mage';
    case Class.ClassMonk: return 'monk';
    case Class.ClassPaladin: return 'paladin';
    case Class.ClassPriest: return 'priest';
    case Class.ClassRogue: return 'rogue';
    case Class.ClassShaman: return 'shaman';
    case Class.ClassWarlock: return 'warlock';
    case Class.ClassWarrior: return 'warrior';
    default: return 'unknown';
  }
};

export const specEnumToString = (specID: Spec): string => {
  switch (specID) {
    // Death Knight
    case Spec.SpecBloodDeathKnight: return 'blood';
    case Spec.SpecFrostDeathKnight: return 'frost';
    case Spec.SpecUnholyDeathKnight: return 'unholy';
    // Druid
    case Spec.SpecBalanceDruid: return 'balance';
    case Spec.SpecFeralDruid: return 'feral';
    case Spec.SpecGuardianDruid: return 'guardian';
    case Spec.SpecRestorationDruid: return 'restoration';
    // Hunter
    case Spec.SpecBeastMasteryHunter: return 'beast_mastery';
    case Spec.SpecMarksmanshipHunter: return 'marksmanship';
    case Spec.SpecSurvivalHunter: return 'survival';
    // Mage
    case Spec.SpecArcaneMage: return 'arcane';
    case Spec.SpecFireMage: return 'fire';
    case Spec.SpecFrostMage: return 'frost';
    // Monk
    case Spec.SpecBrewmasterMonk: return 'brewmaster';
    case Spec.SpecMistweaverMonk: return 'mistweaver';
    case Spec.SpecWindwalkerMonk: return 'windwalker';
    // Paladin
    case Spec.SpecHolyPaladin: return 'holy';
    case Spec.SpecProtectionPaladin: return 'protection';
    case Spec.SpecRetributionPaladin: return 'retribution';
    // Priest
    case Spec.SpecDisciplinePriest: return 'discipline';
    case Spec.SpecHolyPriest: return 'holy';
    case Spec.SpecShadowPriest: return 'shadow';
    // Rogue
    case Spec.SpecAssassinationRogue: return 'assassination';
    case Spec.SpecCombatRogue: return 'combat';
    case Spec.SpecSubtletyRogue: return 'subtlety';
    // Shaman
    case Spec.SpecElementalShaman: return 'elemental';
    case Spec.SpecEnhancementShaman: return 'enhancement';
    case Spec.SpecRestorationShaman: return 'restoration';
    // Warlock
    case Spec.SpecAfflictionWarlock: return 'affliction';
    case Spec.SpecDemonologyWarlock: return 'demonology';
    case Spec.SpecDestructionWarlock: return 'destruction';
    // Warrior
    case Spec.SpecArmsWarrior: return 'arms';
    case Spec.SpecFuryWarrior: return 'fury';
    case Spec.SpecProtectionWarrior: return 'protection';
    default: return 'unknown';
  }
};

export const translateClass = (className: string): string => {
  const normalizedClassName = className.toLowerCase().replace(/_/g, '');
  const i18nKey = normalizedClassName === 'deathknight' ? 'death_knight' : normalizedClassName;
  return i18n.t(`common.classes.${i18nKey}`);
};

export const translateSpec = (className: string, specName: string): string => {
  const normalizedClassName = className.toLowerCase().replace(/_/g, '');
  const classKey = normalizedClassName === 'deathknight' ? 'death_knight' : normalizedClassName;
  const specKey = specName.toLowerCase();
  return i18n.t(`common.specs.${classKey}.${specKey}`);
};
