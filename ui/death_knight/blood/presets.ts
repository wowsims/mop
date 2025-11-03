import * as PresetUtils from '../../core/preset_utils.js';
import { APLRotation_Type } from '../../core/proto/apl.js';
import { ConsumesSpec, Glyphs, Profession, PseudoStat, Spec, Stat } from '../../core/proto/common.js';
import { BloodDeathKnight_Options, DeathKnightMajorGlyph, DeathKnightMinorGlyph } from '../../core/proto/death_knight';
import { SavedTalents } from '../../core/proto/ui.js';
import { Stats } from '../../core/proto_utils/stats';
import DefaultApl from './apls/defensive.apl.json';
import P1BloodGear from './gear_sets/p1.gear.json';
import DefaultBuild from './builds/sha_default.build.json';
import ShaBuild from './builds/sha_without_gear.build.json';
// import PreRaidBloodGear from './gear_sets/preraid.gear.json';

// export const PRERAID_BLOOD_PRESET = PresetUtils.makePresetGear('Pre-Raid', PreRaidBloodGear);
export const P1_BLOOD_PRESET = PresetUtils.makePresetGear('Pre-ToES BiS', P1BloodGear);

export const BLOOD_ROTATION_PRESET_DEFAULT = PresetUtils.makePresetAPLRotation('Sha of Fear', DefaultApl);

// Preset options for EP weights
export const P1_BLOOD_EP_PRESET = PresetUtils.makePresetEpWeights(
	'P1 Balanced',
	Stats.fromMap(
		{
			[Stat.StatStrength]: 1.00,
			[Stat.StatStamina]: 1.54,
			[Stat.StatAttackPower]: 0.29,
			[Stat.StatHitRating]: 1.11,
			[Stat.StatCritRating]: 0.64,
			[Stat.StatHasteRating]: 0.56,
			[Stat.StatExpertiseRating]: 1.01,
			[Stat.StatArmor]: 0.79,
			[Stat.StatDodgeRating]: 0.50,
			[Stat.StatParryRating]: 0.65,
			[Stat.StatBonusArmor]: 0.79,
			[Stat.StatMasteryRating]: 0.19,
		},
		{
			[PseudoStat.PseudoStatMainHandDps]: 1.76,
			[PseudoStat.PseudoStatOffHandDps]: 0.0,
		},
	),
);

// Default talents. Uses the wowhead calculator format, make the talents on
// https://wotlk.wowhead.com/talent-calc and copy the numbers in the url.

export const BloodTalents = {
	name: 'Default',
	data: SavedTalents.create({
		talentsString: "231111",
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

export const PRESET_BUILD_DEFAULT = PresetUtils.makePresetBuildFromJSON("Default", Spec.SpecBloodDeathKnight, DefaultBuild);
export const PRESET_BUILD_SHA = PresetUtils.makePresetBuildFromJSON("Sha of Fear P2", Spec.SpecBloodDeathKnight, ShaBuild);
