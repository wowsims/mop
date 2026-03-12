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
export const P3_PRESET = PresetUtils.makePresetGear('P3 BiS (Balanced)', P3Gear);
import P3OffensiveGear from './gear_sets/p3_offensive.gear.json';
export const P3_OFFENSIVE_PRESET = PresetUtils.makePresetGear('P3 BiS (Offensive)', P3OffensiveGear);
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
import HorridonApl from './apls/horridon.apl.json';
import DefaultBuild from './builds/horridon_default.build.json';
import GarajalBuild from './builds/garajal_encounter_only.build.json';
import EmpressBuild from './builds/empress_encounter_only.build.json';
import ShaBuild from './builds/sha_encounter_only.build.json';
import HorridonBuild from './builds/horridon_encounter_only.build.json';
export const ROTATION_DEFAULT = PresetUtils.makePresetAPLRotation("Gara'jal Default", DefaultApl);
export const ROTATION_HOTW = PresetUtils.makePresetAPLRotation("Gara'jal Offensive HotW", OffensiveHotwApl);
export const ROTATION_EMPRESS = PresetUtils.makePresetAPLRotation("Empress Adds", EmpressApl);
export const ROTATION_SHA = PresetUtils.makePresetAPLRotation("Sha Hybrid HotW", ShaApl);
export const ROTATION_HORRIDON = PresetUtils.makePresetAPLRotation("Horridon Tank 2", HorridonApl);

//export const ROTATION_PRESET_SIMPLE = PresetUtils.makePresetSimpleRotation('Simple Default', Spec.SpecGuardianDruid, DefaultSimpleRotation);

// Preset options for EP weights
export const SURVIVAL_EP_PRESET = PresetUtils.makePresetEpWeights(
	'Survival',
	Stats.fromMap(
		{
			[Stat.StatHealth]: 0.17,
			[Stat.StatStamina]: 3.93,
			[Stat.StatAgility]: 1.0,
			[Stat.StatArmor]: 4.81,
			[Stat.StatBonusArmor]: 1.10,
			[Stat.StatDodgeRating]: 0.76,
			[Stat.StatMasteryRating]: 2.20,
			[Stat.StatStrength]: 0.02,
			[Stat.StatAttackPower]: 0.02,
			[Stat.StatHitRating]: 1.07,
			[Stat.StatExpertiseRating]: 1.06,
			[Stat.StatCritRating]: 0.61,
			[Stat.StatHasteRating]: 0.77,
		},
		{
			[PseudoStat.PseudoStatMainHandDps]: 0.0,
			[PseudoStat.PseudoStatPhysicalHitPercent]: 1.07 * Mechanics.PHYSICAL_HIT_RATING_PER_HIT_PERCENT,
			[PseudoStat.PseudoStatSpellHitPercent]: 0.01 * Mechanics.SPELL_HIT_RATING_PER_HIT_PERCENT,
		},
	),
);

export const BALANCED_EP_PRESET = PresetUtils.makePresetEpWeights(
	'Balanced',
	Stats.fromMap(
		{
			[Stat.StatHealth]: 0.06,
			[Stat.StatStamina]: 1.41,
			[Stat.StatAgility]: 1.0,
			[Stat.StatArmor]: 1.70,
			[Stat.StatBonusArmor]: 0.39,
			[Stat.StatDodgeRating]: 0.28,
			[Stat.StatMasteryRating]: 0.78,
			[Stat.StatStrength]: 0.18,
			[Stat.StatAttackPower]: 0.18,
			[Stat.StatHitRating]: 1.50,
			[Stat.StatExpertiseRating]: 1.50,
			[Stat.StatCritRating]: 1.07,
			[Stat.StatHasteRating]: 0.60,
		},
		{
			[PseudoStat.PseudoStatMainHandDps]: 0.84,
			[PseudoStat.PseudoStatPhysicalHitPercent]: 1.50 * Mechanics.PHYSICAL_HIT_RATING_PER_HIT_PERCENT,
			[PseudoStat.PseudoStatSpellHitPercent]: 0.0 * Mechanics.SPELL_HIT_RATING_PER_HIT_PERCENT,
		},
	),
);

export const OFFENSIVE_EP_PRESET = PresetUtils.makePresetEpWeights(
	'Offensive',
	Stats.fromMap(
		{
			[Stat.StatHealth]: 0.03,
			[Stat.StatStamina]: 0.64,
			[Stat.StatAgility]: 1.0,
			[Stat.StatArmor]: 0.76,
			[Stat.StatBonusArmor]: 0.17,
			[Stat.StatDodgeRating]: 0.13,
			[Stat.StatMasteryRating]: 0.35,
			[Stat.StatStrength]: 0.23,
			[Stat.StatAttackPower]: 0.22,
			[Stat.StatHitRating]: 1.64,
			[Stat.StatExpertiseRating]: 1.64,
			[Stat.StatCritRating]: 1.21,
			[Stat.StatHasteRating]: 0.54,
		},
		{
			[PseudoStat.PseudoStatMainHandDps]: 1.09,
			[PseudoStat.PseudoStatPhysicalHitPercent]: 1.64 * Mechanics.PHYSICAL_HIT_RATING_PER_HIT_PERCENT,
			[PseudoStat.PseudoStatSpellHitPercent]: 0.0 * Mechanics.SPELL_HIT_RATING_PER_HIT_PERCENT,
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
export const PRESET_BUILD_HORRIDON = PresetUtils.makePresetBuildFromJSON("Horridon P2", Spec.SpecGuardianDruid, HorridonBuild);
