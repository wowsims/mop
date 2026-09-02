import * as PresetUtils from '@app/preset_utils';

import { ConsumesSpec, Profession, Spec, Stat } from '../../core/proto/common';
import { DruidMajorGlyph, GuardianDruid_Options as DruidOptions, GuardianDruid_Rotation as DruidRotation } from '../../core/proto/druid';
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
import P5Gear from './gear_sets/p5.gear.json';
export const P5_PRESET = PresetUtils.makePresetGear('P5 BiS (Balanced)', P5Gear);
import P5OffensiveGear from './gear_sets/p5_offensive.gear.json';
export const P5_OFFENSIVE_PRESET = PresetUtils.makePresetGear('P5 BiS (Offensive)', P5OffensiveGear);
import ItemSwapGear from './gear_sets/p2_item_swap.gear.json';
export const ITEM_SWAP_PRESET = PresetUtils.makePresetItemSwapGear('HotW Caster Weapon Swap', ItemSwapGear);

export const DefaultSimpleRotation = DruidRotation.create({
	maintainFaerieFire: true,
	maintainDemoralizingRoar: true,
	demoTime: 4.0,
	pulverizeTime: 4.0,
	prepullStampede: true,
});

import DefaultApl from './apls/default.apl.json';
import EmpressApl from './apls/empress.apl.json';
import HorridonApl from './apls/horridon.apl.json';
import IJApl from './apls/ij.apl.json';
import OffensiveHotwApl from './apls/offensiveHotw.apl.json';
import ShaApl from './apls/sha.apl.json';
import EmpressBuild from './builds/empress_encounter_only.build.json';
import GarajalBuild from './builds/garajal_encounter_only.build.json';
import HorridonBuild from './builds/horridon_encounter_only.build.json';
import DefaultBuild from './builds/ij_default.build.json';
import IJBuild from './builds/ij_encounter_only.build.json';
import ShaBuild from './builds/sha_encounter_only.build.json';
import BalancedEpJson from './presets/ep/balanced.ep.json';
import OffensiveEpJson from './presets/ep/offensive.ep.json';
import DefaultTalentsJson from './presets/talents/default.talents.json';

export const ROTATION_DEFAULT = PresetUtils.makePresetAPLRotation("Gara'jal Default", DefaultApl);
export const ROTATION_HOTW = PresetUtils.makePresetAPLRotation("Gara'jal Offensive HotW", OffensiveHotwApl);
export const ROTATION_EMPRESS = PresetUtils.makePresetAPLRotation('Empress Adds', EmpressApl);
export const ROTATION_SHA = PresetUtils.makePresetAPLRotation('Sha Hybrid HotW', ShaApl);
export const ROTATION_HORRIDON = PresetUtils.makePresetAPLRotation('Horridon Tank 2', HorridonApl);
export const ROTATION_IJ = PresetUtils.makePresetAPLRotation('Iron Juggernaut', IJApl);

//export const ROTATION_PRESET_SIMPLE = PresetUtils.makePresetSimpleRotation('Simple Default', Spec.SpecGuardianDruid, DefaultSimpleRotation);

// Preset options for EP weights
export const BALANCED_EP_PRESET = PresetUtils.makePresetEpWeightsFromJSON(BalancedEpJson);

export const BALANCED_PRECAP_EPS = BALANCED_EP_PRESET.epWeights
	.withStat(Stat.StatCritRating, 1.36)
	.withStat(Stat.StatHitRating, 3.31)
	.withStat(Stat.StatExpertiseRating, 3.31);

export const BALANCED_PRECAP_EP_PRESET = PresetUtils.makePresetEpWeights('Balanced Pre-Caps', BALANCED_PRECAP_EPS);

export const OFFENSIVE_EP_PRESET = PresetUtils.makePresetEpWeightsFromJSON(OffensiveEpJson);

export const OFFENSIVE_PRECAP_EPS = OFFENSIVE_EP_PRESET.epWeights.withStat(Stat.StatHitRating, 2.91).withStat(Stat.StatExpertiseRating, 2.91);

export const OFFENSIVE_PRECAP_EP_PRESET = PresetUtils.makePresetEpWeights('Offensive Pre-Caps', OFFENSIVE_PRECAP_EPS);

// Default talents. Uses the wowhead calculator format, make the talents on
// https://wowhead.com/mop-classic/talent-calc and copy the numbers in the url.
export const DefaultTalents = PresetUtils.makePresetTalentsFromJSON(DefaultTalentsJson, { major: DruidMajorGlyph });

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

export const PRESET_BUILD_DEFAULT = PresetUtils.makePresetBuildFromJSON('All Defaults', Spec.SpecGuardianDruid, DefaultBuild);
export const PRESET_BUILD_GARAJAL = PresetUtils.makePresetBuildFromJSON("Gara'jal", Spec.SpecGuardianDruid, GarajalBuild);
export const PRESET_BUILD_EMPRESS = PresetUtils.makePresetBuildFromJSON('Empress P2 Adds', Spec.SpecGuardianDruid, EmpressBuild);
export const PRESET_BUILD_SHA = PresetUtils.makePresetBuildFromJSON('Sha of Fear P2', Spec.SpecGuardianDruid, ShaBuild);
export const PRESET_BUILD_HORRIDON = PresetUtils.makePresetBuildFromJSON('Horridon P2', Spec.SpecGuardianDruid, HorridonBuild);
export const PRESET_BUILD_IJ = PresetUtils.makePresetBuildFromJSON('Iron Juggernaut P1', Spec.SpecGuardianDruid, IJBuild);
