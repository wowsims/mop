import * as Mechanics from '../../core/constants/mechanics.js';
import * as PresetUtils from '../../core/preset_utils.js';
import { ConsumesSpec, Glyphs, Profession, PseudoStat, Spec, Stat } from '../../core/proto/common';
import { DruidMajorGlyph, GuardianDruid_Options as DruidOptions, GuardianDruid_Rotation as DruidRotation } from '../../core/proto/druid.js';
import { SavedTalents } from '../../core/proto/ui.js';
// Preset options for this spec.
// Eventually we will import these values for the raid sim too, so its good to
// keep them in a separate file.
import PreraidGear from './gear_sets/preraid.gear.json';
export const PRERAID_PRESET = PresetUtils.makePresetGear('Pre-MSV BiS', PreraidGear);
import P1Gear from './gear_sets/p1.gear.json';
export const P1_PRESET = PresetUtils.makePresetGear('P1/P2', P1Gear);
import P2Gear from './gear_sets/p2.gear.json';
export const P2_PRESET = PresetUtils.makePresetGear('P2', P2Gear);
import P3Gear from './gear_sets/p3.gear.json';
export const P3_PRESET = PresetUtils.makePresetGear('P3', P3Gear);
import P4Gear from './gear_sets/p4.gear.json';
export const P4_PRESET = PresetUtils.makePresetGear('P4', P4Gear);

export const DefaultSimpleRotation = DruidRotation.create({
	maintainFaerieFire: true,
	maintainDemoralizingRoar: true,
	demoTime: 4.0,
	pulverizeTime: 4.0,
	prepullStampede: true,
});

import { Stats } from '../../core/proto_utils/stats';
import DefaultApl from './apls/default.apl.json';
import OffensiveHotwApl from './apls/offensiveHotw.apl.json';
import DefaultBuild from './builds/garajal_default.build.json';
import GarajalBuild from './builds/garajal_encounter_only.build.json';
export const ROTATION_DEFAULT = PresetUtils.makePresetAPLRotation("Gara'jal Default", DefaultApl);
export const ROTATION_HOTW = PresetUtils.makePresetAPLRotation("Gara'jal Offensive HotW", OffensiveHotwApl);

//export const ROTATION_PRESET_SIMPLE = PresetUtils.makePresetSimpleRotation('Simple Default', Spec.SpecGuardianDruid, DefaultSimpleRotation);

// Preset options for EP weights
export const SURVIVAL_EP_PRESET = PresetUtils.makePresetEpWeights(
	'Survival',
	Stats.fromMap(
		{
			[Stat.StatHealth]: 0.08,
			[Stat.StatStamina]: 1.75,
			[Stat.StatAgility]: 1.0,
			[Stat.StatArmor]: 2.21,
			[Stat.StatBonusArmor]: 0.5,
			[Stat.StatDodgeRating]: 0.68,
			[Stat.StatMasteryRating]: 0.92,
			[Stat.StatStrength]: 0.06,
			[Stat.StatAttackPower]: 0.06,
			[Stat.StatHitRating]: 1.17,
			[Stat.StatExpertiseRating]: 1.09,
			[Stat.StatCritRating]: 1.06,
			[Stat.StatHasteRating]: 0.38,
		},
		{
			[PseudoStat.PseudoStatMainHandDps]: 0.0,
			[PseudoStat.PseudoStatPhysicalHitPercent]: 1.09 * Mechanics.PHYSICAL_HIT_RATING_PER_HIT_PERCENT,
			[PseudoStat.PseudoStatSpellHitPercent]: 0.08 * Mechanics.SPELL_HIT_RATING_PER_HIT_PERCENT,
		},
	),
);

export const BALANCED_EP_PRESET = PresetUtils.makePresetEpWeights(
	'Balanced',
	Stats.fromMap(
		{
			[Stat.StatHealth]: 0.06,
			[Stat.StatStamina]: 1.39,
			[Stat.StatAgility]: 1.0,
			[Stat.StatArmor]: 1.75,
			[Stat.StatBonusArmor]: 0.40,
			[Stat.StatDodgeRating]: 0.53,
			[Stat.StatMasteryRating]: 0.73,
			[Stat.StatStrength]: 0.12,
			[Stat.StatAttackPower]: 0.11,
			[Stat.StatHitRating]: 1.16,
			[Stat.StatExpertiseRating]: 1.08,
			[Stat.StatCritRating]: 1.05,
			[Stat.StatHasteRating]: 0.37,
		},
		{
			[PseudoStat.PseudoStatMainHandDps]: 0.29,
			[PseudoStat.PseudoStatPhysicalHitPercent]: 1.08 * Mechanics.PHYSICAL_HIT_RATING_PER_HIT_PERCENT,
			[PseudoStat.PseudoStatSpellHitPercent]: 0.08 * Mechanics.SPELL_HIT_RATING_PER_HIT_PERCENT,
		},
	),
);

// Default talents. Uses the wowhead calculator format, make the talents on
// https://wowhead.com/mop-classic/talent-calc and copy the numbers in the url.
export const DefensiveTalents = {
	name: 'Defensive',
	data: SavedTalents.create({
		talentsString: '010101',
		glyphs: Glyphs.create({
			major1: DruidMajorGlyph.GlyphOfMightOfUrsoc,
			major2: DruidMajorGlyph.GlyphOfMaul,
		}),
	}),
};

export const OffensiveTalents = {
	name: 'Offensive',
	data: SavedTalents.create({
		talentsString: '010103',
		glyphs: Glyphs.create({
			major1: DruidMajorGlyph.GlyphOfMightOfUrsoc,
			major2: DruidMajorGlyph.GlyphOfMaul,
		}),
	}),
};

export const DefaultOptions = DruidOptions.create({});

export const DefaultConsumables = ConsumesSpec.create({
	flaskId: 76087,
	foodId: 74656,
	potId: 76090,
	prepotId: 76090,
	conjuredId: 5512, // Conjured Healthstone
});
export const OtherDefaults = {
	iterationCount: 50000,
	profession1: Profession.Engineering,
	profession2: Profession.ProfessionUnknown,
};

export const PRESET_BUILD_DEFAULT = PresetUtils.makePresetBuildFromJSON("Default", Spec.SpecGuardianDruid, DefaultBuild);
export const PRESET_BUILD_GARAJAL = PresetUtils.makePresetBuildFromJSON("Gara'jal", Spec.SpecGuardianDruid, GarajalBuild);
