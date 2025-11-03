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
import MsvGear from './gear_sets/msv.gear.json';
export const MSV_PRESET = PresetUtils.makePresetGear('Pre-HoF BiS', MsvGear);
import HofGear from './gear_sets/hof.gear.json';
export const HOF_PRESET = PresetUtils.makePresetGear('Pre-ToES BiS', HofGear);
import P1Gear from './gear_sets/p1.gear.json';
export const P1_PRESET = PresetUtils.makePresetGear('P1/P2', P1Gear);
import P2Gear from './gear_sets/p2.gear.json';
export const P2_PRESET = PresetUtils.makePresetGear('P2 BiS (Balanced)', P2Gear);
import P2OffensiveGear from './gear_sets/p2_offensive.gear.json';
export const P2_OFFENSIVE_PRESET = PresetUtils.makePresetGear('P2 BiS (Offensive)', P2OffensiveGear);
import P3Gear from './gear_sets/p3.gear.json';
export const P3_PRESET = PresetUtils.makePresetGear('P3', P3Gear);
import P4Gear from './gear_sets/p4.gear.json';
export const P4_PRESET = PresetUtils.makePresetGear('P4', P4Gear);
import ItemSwapGear from './gear_sets/p2_item_swap.gear.json';
export const ITEM_SWAP_PRESET = PresetUtils.makePresetItemSwapGear('HotW Caster Weapon Swap', ItemSwapGear);

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
import EmpressApl from './apls/empress.apl.json';
import ShaApl from './apls/sha.apl.json';
import DefaultBuild from './builds/sha_default.build.json';
import GarajalBuild from './builds/garajal_encounter_only.build.json';
import EmpressBuild from './builds/empress_encounter_only.build.json';
import ShaBuild from './builds/sha_encounter_only.build.json';
export const ROTATION_DEFAULT = PresetUtils.makePresetAPLRotation("Gara'jal Default", DefaultApl);
export const ROTATION_HOTW = PresetUtils.makePresetAPLRotation("Gara'jal Offensive HotW", OffensiveHotwApl);
export const ROTATION_EMPRESS = PresetUtils.makePresetAPLRotation("Empress Adds", EmpressApl);
export const ROTATION_SHA = PresetUtils.makePresetAPLRotation("Sha Hybrid HotW", ShaApl);

//export const ROTATION_PRESET_SIMPLE = PresetUtils.makePresetSimpleRotation('Simple Default', Spec.SpecGuardianDruid, DefaultSimpleRotation);

// Preset options for EP weights
export const SURVIVAL_EP_PRESET = PresetUtils.makePresetEpWeights(
	'Survival',
	Stats.fromMap(
		{
			[Stat.StatHealth]: 0.11,
			[Stat.StatStamina]: 2.55,
			[Stat.StatAgility]: 1.0,
			[Stat.StatArmor]: 4.48,
			[Stat.StatBonusArmor]: 1.02,
			[Stat.StatDodgeRating]: 0.70,
			[Stat.StatMasteryRating]: 1.89,
			[Stat.StatStrength]: 0.03,
			[Stat.StatAttackPower]: 0.03,
			[Stat.StatHitRating]: 1.18,
			[Stat.StatExpertiseRating]: 1.16,
			[Stat.StatCritRating]: 0.72,
			[Stat.StatHasteRating]: 0.80,
		},
		{
			[PseudoStat.PseudoStatMainHandDps]: 0.0,
			[PseudoStat.PseudoStatPhysicalHitPercent]: 1.16 * Mechanics.PHYSICAL_HIT_RATING_PER_HIT_PERCENT,
			[PseudoStat.PseudoStatSpellHitPercent]: 0.02 * Mechanics.SPELL_HIT_RATING_PER_HIT_PERCENT,
		},
	),
);

export const BALANCED_EP_PRESET = PresetUtils.makePresetEpWeights(
	'Balanced',
	Stats.fromMap(
		{
			[Stat.StatHealth]: 0.04,
			[Stat.StatStamina]: 0.86,
			[Stat.StatAgility]: 1.0,
			[Stat.StatArmor]: 1.51,
			[Stat.StatBonusArmor]: 0.34,
			[Stat.StatDodgeRating]: 0.24,
			[Stat.StatMasteryRating]: 0.64,
			[Stat.StatStrength]: 0.17,
			[Stat.StatAttackPower]: 0.16,
			[Stat.StatHitRating]: 0.86,
			[Stat.StatExpertiseRating]: 0.85,
			[Stat.StatCritRating]: 0.65,
			[Stat.StatHasteRating]: 0.56,
		},
		{
			[PseudoStat.PseudoStatMainHandDps]: 0.70,
			[PseudoStat.PseudoStatPhysicalHitPercent]: 0.85 * Mechanics.PHYSICAL_HIT_RATING_PER_HIT_PERCENT,
			[PseudoStat.PseudoStatSpellHitPercent]: 0.01 * Mechanics.SPELL_HIT_RATING_PER_HIT_PERCENT,
		},
	),
);

export const OFFENSIVE_EP_PRESET = PresetUtils.makePresetEpWeights(
	'Offensive',
	Stats.fromMap(
		{
			[Stat.StatHealth]: 0.02,
			[Stat.StatStamina]: 0.51,
			[Stat.StatAgility]: 1.0,
			[Stat.StatArmor]: 0.90,
			[Stat.StatBonusArmor]: 0.20,
			[Stat.StatDodgeRating]: 0.14,
			[Stat.StatMasteryRating]: 0.38,
			[Stat.StatStrength]: 0.20,
			[Stat.StatAttackPower]: 0.19,
			[Stat.StatHitRating]: 0.80,
			[Stat.StatExpertiseRating]: 0.79,
			[Stat.StatCritRating]: 0.63,
			[Stat.StatHasteRating]: 0.51,
		},
		{
			[PseudoStat.PseudoStatMainHandDps]: 0.85,
			[PseudoStat.PseudoStatPhysicalHitPercent]: 0.79 * Mechanics.PHYSICAL_HIT_RATING_PER_HIT_PERCENT,
			[PseudoStat.PseudoStatSpellHitPercent]: 0.01 * Mechanics.SPELL_HIT_RATING_PER_HIT_PERCENT,
		},
	),
);

// Default talents. Uses the wowhead calculator format, make the talents on
// https://wowhead.com/mop-classic/talent-calc and copy the numbers in the url.
export const DefaultTalents = {
	name: 'Default',
	data: SavedTalents.create({
		talentsString: '010101',
		glyphs: Glyphs.create({
			major1: DruidMajorGlyph.GlyphOfMightOfUrsoc,
			major2: DruidMajorGlyph.GlyphOfMaul,
			major3: DruidMajorGlyph.GlyphOfStampedingRoar,
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

export const PRESET_BUILD_DEFAULT = PresetUtils.makePresetBuildFromJSON("All Defaults", Spec.SpecGuardianDruid, DefaultBuild);
export const PRESET_BUILD_GARAJAL = PresetUtils.makePresetBuildFromJSON("Gara'jal", Spec.SpecGuardianDruid, GarajalBuild);
export const PRESET_BUILD_EMPRESS = PresetUtils.makePresetBuildFromJSON("Empress P2 Adds", Spec.SpecGuardianDruid, EmpressBuild);
export const PRESET_BUILD_SHA = PresetUtils.makePresetBuildFromJSON("Sha of Fear P2", Spec.SpecGuardianDruid, ShaBuild);
