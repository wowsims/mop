import * as PresetUtils from '../../core/preset_utils.js';
import { ConsumesSpec, Glyphs, Profession, PseudoStat, Spec, Stat } from '../../core/proto/common.js';
import { BloodDeathKnight_Options, DeathKnightMajorGlyph, DeathKnightMinorGlyph } from '../../core/proto/death_knight';
import { SavedTalents } from '../../core/proto/ui.js';
import { Stats } from '../../core/proto_utils/stats';
import ShaApl from './apls/sha.apl.json';
import HorridonApl from './apls/horridon.apl.json';
import P2BalancedBloodGear from './gear_sets/p2.gear.json';
import P2OffensiveBloodGear from './gear_sets/p2_offensive.gear.json';
import P4BalancedBloodGear from './gear_sets/p4.gear.json';
import P4ProgBloodGear from './gear_sets/p4_prog.gear.json';
import P4OffensiveBloodGear from './gear_sets/p4_offensive.gear.json';
import DefaultBuild from './builds/sha_default.build.json';
import ShaBuild from './builds/sha_encounter_only.build.json';
import HorridonBuild from './builds/horridon_encounter_only.build.json';
// import PreRaidBloodGear from './gear_sets/preraid.gear.json';

// export const PRERAID_BLOOD_PRESET = PresetUtils.makePresetGear('Pre-Raid', PreRaidBloodGear);
export const P2_BALANCED_BLOOD_PRESET = PresetUtils.makePresetGear('P2 - BIS (Balanced)', P2BalancedBloodGear);
export const P2_OFFENSIVE_BLOOD_PRESET = PresetUtils.makePresetGear('P2 - BIS (Offensive)', P2OffensiveBloodGear);
export const P3_4_PROG_BLOOD_PRESET = PresetUtils.makePresetGear('P3 & P4 - Prog (Survival)', P4ProgBloodGear);
export const P3_4_BALANCED_BLOOD_PRESET = PresetUtils.makePresetGear('P3 & P4 - BIS (Balanced)', P4BalancedBloodGear);
export const P3_4_OFFENSIVE_BLOOD_PRESET = PresetUtils.makePresetGear('P3 & P4 - BIS (Offensive)', P4OffensiveBloodGear);

export const BLOOD_ROTATION_PRESET_SHA = PresetUtils.makePresetAPLRotation('Sha of Fear', ShaApl);
export const BLOOD_ROTATION_PRESET_HORRIDON = PresetUtils.makePresetAPLRotation('Horridon', HorridonApl);

// Preset options for EP weights
export const P2_BALANCED_EP_PRESET = PresetUtils.makePresetEpWeights(
	'P2 - Balanced',
	Stats.fromMap(
		{
			[Stat.StatStrength]: 1.0,
			[Stat.StatStamina]: 1.02,
			[Stat.StatHitRating]: 1.17,
			[Stat.StatCritRating]: 0.6,
			[Stat.StatHasteRating]: 0.59,
			[Stat.StatExpertiseRating]: 1.02,
			[Stat.StatDodgeRating]: 0.74,
			[Stat.StatParryRating]: 0.75,
			[Stat.StatMasteryRating]: 0.47,
			[Stat.StatAttackPower]: 0.25,
			[Stat.StatArmor]: 0.54,
			[Stat.StatBonusArmor]: 0.54,
		},
		{
			[PseudoStat.PseudoStatMainHandDps]: 2.7,
		},
	),
);

export const P2_OFFENSIVE_EP_PRESET = PresetUtils.makePresetEpWeights(
	'P2 - Offensive',
	Stats.fromMap(
		{
			[Stat.StatStrength]: 1.0,
			[Stat.StatStamina]: 0.56,
			[Stat.StatHitRating]: 1.42,
			[Stat.StatCritRating]: 0.75,
			[Stat.StatHasteRating]: 0.71,
			[Stat.StatExpertiseRating]: 1.25,
			[Stat.StatDodgeRating]: 0.65,
			[Stat.StatParryRating]: 0.66,
			[Stat.StatMasteryRating]: 0.26,
			[Stat.StatAttackPower]: 0.32,
			[Stat.StatArmor]: 0.3,
			[Stat.StatBonusArmor]: 0.35,
		},
		{
			[PseudoStat.PseudoStatMainHandDps]: 2.9,
		},
	),
);

export const P3_4_SURVIVAL_EP_PRESET = PresetUtils.makePresetEpWeights(
	'P3 & P4 - Survival',
	Stats.fromMap(
		{
			[Stat.StatStrength]: 1.0,
			[Stat.StatStamina]: 1.38,
			[Stat.StatHitRating]: 1.5,
			[Stat.StatCritRating]: 0.65,
			[Stat.StatHasteRating]: 0.83,
			[Stat.StatExpertiseRating]: 1.18,
			[Stat.StatDodgeRating]: 0.95,
			[Stat.StatParryRating]: 0.97,
			[Stat.StatMasteryRating]: 1.35,
			[Stat.StatAttackPower]: 0.17,
			[Stat.StatArmor]: 0.77,
			[Stat.StatBonusArmor]: 0.77,
		},
		{
			[PseudoStat.PseudoStatMainHandDps]: 1.84,
		},
	),
);

export const P3_4_BALANCED_EP_PRESET = PresetUtils.makePresetEpWeights(
	'P3 & P4 - Balanced',
	Stats.fromMap(
		{
			[Stat.StatStrength]: 1.0,
			[Stat.StatStamina]: 1.02,
			[Stat.StatHitRating]: 1.77,
			[Stat.StatCritRating]: 0.85,
			[Stat.StatHasteRating]: 0.89,
			[Stat.StatExpertiseRating]: 1.5,
			[Stat.StatDodgeRating]: 0.97,
			[Stat.StatParryRating]: 0.99,
			[Stat.StatMasteryRating]: 0.98,
			[Stat.StatAttackPower]: 0.23,
			[Stat.StatArmor]: 0.57,
			[Stat.StatBonusArmor]: 0.57,
		},
		{
			[PseudoStat.PseudoStatMainHandDps]: 1.94,
		},
	),
);

export const P3_4_OFFENSIVE_EP_PRESET = PresetUtils.makePresetEpWeights(
	'P3 & P4 - Offensive',
	Stats.fromMap(
		{
			[Stat.StatStrength]: 1.0,
			[Stat.StatStamina]: 0.35,
			[Stat.StatHitRating]: 2.27,
			[Stat.StatCritRating]: 1.24,
			[Stat.StatHasteRating]: 0.99,
			[Stat.StatExpertiseRating]: 2.08,
			[Stat.StatDodgeRating]: 1.0,
			[Stat.StatParryRating]: 1.03,
			[Stat.StatMasteryRating]: 0.29,
			[Stat.StatAttackPower]: 0.33,
			[Stat.StatArmor]: 0.2,
			[Stat.StatBonusArmor]: 0.2,
		},
		{
			[PseudoStat.PseudoStatMainHandDps]: 2.15,
		},
	),
);

// Default talents. Uses the wowhead calculator format, make the talents on
// https://wotlk.wowhead.com/talent-calc and copy the numbers in the url.

export const BloodTalents = {
	name: 'Default',
	data: SavedTalents.create({
		talentsString: '231111',
		glyphs: Glyphs.create({
			major1: DeathKnightMajorGlyph.GlyphOfLoudHorn,
			major2: DeathKnightMajorGlyph.GlyphOfRegenerativeMagic,
			major3: DeathKnightMajorGlyph.GlyphOfIceboundFortitude,
			minor1: DeathKnightMinorGlyph.GlyphOfTheLongWinter,
			minor2: DeathKnightMinorGlyph.GlyphOfArmyOfTheDead,
			minor3: DeathKnightMinorGlyph.GlyphOfResilientGrip,
		}),
	}),
};

export const DefaultOptions = BloodDeathKnight_Options.create({
	classOptions: {},
});

export const DefaultConsumables = ConsumesSpec.create({
	flaskId: 76087, // Flask of the Earth
	foodId: 74656, // Chun Tian Spring Rolls
	potId: 76095, // Potion of Mogu Power
	prepotId: 76095, // Potion of Mogu Power
});

export const OtherDefaults = {
	profession1: Profession.Engineering,
	profession2: Profession.Blacksmithing,
	distanceFromTarget: 5,
	iterationCount: 25000,
};

export const PRESET_BUILD_DEFAULT = PresetUtils.makePresetBuildFromJSON('Default', Spec.SpecBloodDeathKnight, DefaultBuild);
export const PRESET_BUILD_SHA = PresetUtils.makePresetBuildFromJSON('Sha of Fear P2', Spec.SpecBloodDeathKnight, ShaBuild);
export const PRESET_BUILD_HORRIDON = PresetUtils.makePresetBuildFromJSON('Horridon P2', Spec.SpecBloodDeathKnight, HorridonBuild);
