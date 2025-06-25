import { Spec } from '../proto/common';

export const CHARACTER_LEVEL = 90;
export const BOSS_LEVEL = CHARACTER_LEVEL + 3;
export const MAX_CHALLENGE_MODE_ILVL = 463;

export const HASTE_RATING_PER_HASTE_PERCENT = 425.0;
export const EXPERTISE_PER_QUARTER_PERCENT_REDUCTION = 85.0;
export const CRIT_RATING_PER_CRIT_PERCENT = 600.0;
export const PHYSICAL_HIT_RATING_PER_HIT_PERCENT = 340.0;
export const SPELL_HIT_RATING_PER_HIT_PERCENT = 340.0;
export const DODGE_RATING_PER_DODGE_PERCENT = 885.0;
export const PARRY_RATING_PER_PARRY_PERCENT = 885.0;
export const MASTERY_RATING_PER_MASTERY_POINT = 600.0;

// TODO: Adjust for MoP values
// Mastery Ratings have various increments based on spec.
export const masteryPercentPerPoint: Map<Spec, number> = new Map([
	[Spec.SpecAssassinationRogue, 3.5],
	[Spec.SpecCombatRogue, 2.0],
	[Spec.SpecSubtletyRogue, 2.5],
	[Spec.SpecBloodDeathKnight, 6.25],
	[Spec.SpecFrostDeathKnight, 2.0],
	[Spec.SpecUnholyDeathKnight, 2.5],
	[Spec.SpecBalanceDruid, 1.875],
	[Spec.SpecFeralDruid, 3.125],
	[Spec.SpecGuardianDruid, 2.0],
	[Spec.SpecRestorationDruid, 1.25],
	[Spec.SpecHolyPaladin, 1.5],
	[Spec.SpecProtectionPaladin, 1.0],
	[Spec.SpecRetributionPaladin, 1.85],
	[Spec.SpecElementalShaman, 2.0],
	[Spec.SpecEnhancementShaman, 2.0],
	[Spec.SpecRestorationShaman, 3.0],
	[Spec.SpecBeastMasteryHunter, 2],
	[Spec.SpecMarksmanshipHunter, 2],
	[Spec.SpecSurvivalHunter, 1.0],
	[Spec.SpecArmsWarrior, 2.2],
	[Spec.SpecFuryWarrior, 1.4],
	[Spec.SpecProtectionWarrior, 2.2],
	[Spec.SpecArcaneMage, 2],
	[Spec.SpecFireMage, 1.5],
	[Spec.SpecFrostMage, 2],
	[Spec.SpecDisciplinePriest, 2.5],
	[Spec.SpecHolyPriest, 1.25],
	[Spec.SpecShadowPriest, 1.8],
	[Spec.SpecAfflictionWarlock, 3.1],
	[Spec.SpecDemonologyWarlock, 3],
	[Spec.SpecDestructionWarlock, 3],
	[Spec.SpecWindwalkerMonk, 0.2],
	[Spec.SpecBrewmasterMonk, 0.625],
]);
