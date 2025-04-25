import { Spec } from "../proto/common";

export const CHARACTER_LEVEL = 85;
export const BOSS_LEVEL = CHARACTER_LEVEL + 3;

export const EXPERTISE_PER_QUARTER_PERCENT_REDUCTION = 30.027197;
export const CRIT_RATING_PER_CRIT_PERCENT = 179.280040;
export const PHYSICAL_HIT_RATING_PER_HIT_PERCENT = 120.108800;
export const SPELL_HIT_RATING_PER_HIT_PERCENT = 102.445740;
export const HASTE_RATING_PER_HASTE_PERCENT = 128.057160;
export const MASTERY_RATING_PER_MASTERY_POINT = 179.280040;
export const DODGE_RATING_PER_DODGE_PERCENT = 176.718900;
export const PARRY_RATING_PER_PARRY_PERCENT = 176.718900;

// Mastery Ratings have various increments based on spec.
export const masteryPercentPerPoint: Map<Spec, number> = new Map([
	[Spec.SpecAssassinationRogue, 3.5],
	[Spec.SpecCombatRogue, 2.0],
	[Spec.SpecSubtletyRogue, 2.5],
	[Spec.SpecBloodDeathKnight, 6.25],
	[Spec.SpecFrostDeathKnight, 2.0],
	[Spec.SpecUnholyDeathKnight, 2.5],
	[Spec.SpecBalanceDruid, 2.0],
	[Spec.SpecFeralDruid, 3.125],
	[Spec.SpecGuardianDruid, 4.0],
	[Spec.SpecRestorationDruid, 1.25],
	[Spec.SpecHolyPaladin, 1.5],
	[Spec.SpecProtectionPaladin, 2.25],
	[Spec.SpecRetributionPaladin, 2.1],
	[Spec.SpecElementalShaman, 2.0],
	[Spec.SpecEnhancementShaman, 2.5],
	[Spec.SpecRestorationShaman, 3.0],
	[Spec.SpecBeastMasteryHunter, 1.675],
	[Spec.SpecMarksmanshipHunter, 2.1],
	[Spec.SpecSurvivalHunter, 1.0],
	[Spec.SpecArmsWarrior, 2.2],
	[Spec.SpecFuryWarrior, 5.6],
	[Spec.SpecProtectionWarrior, 1.5],
	[Spec.SpecArcaneMage, 1.5],
	[Spec.SpecFireMage, 2.8],
	[Spec.SpecFrostMage, 2.5],
	[Spec.SpecDisciplinePriest, 2.5],
	[Spec.SpecHolyPriest, 1.25],
	[Spec.SpecShadowPriest, 1.45],
	[Spec.SpecAfflictionWarlock, 1.625],
	[Spec.SpecDemonologyWarlock, 2.3],
	[Spec.SpecDestructionWarlock, 1.35],
	[Spec.SpecWindwalkerMonk, 2.5],
]);
