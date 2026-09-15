import * as PresetUtils from '@app/preset_utils';
import { ConsumesSpec, Profession, Spec } from '@generated/proto/common';
import { BloodDeathKnight_Options, DeathKnightMajorGlyph, DeathKnightMinorGlyph } from '@generated/proto/death_knight';

import HorridonApl from './apls/horridon.apl.json';
import IronJuggernautApl from './apls/iron_juggernaut.apl.json';
import ShaApl from './apls/sha.apl.json';
import HorridonBuild from './builds/horridon_encounter_only.build.json';
import IronJuggernautBuild from './builds/iron_juggernaut_encounter_only.build.json';
import DefaultBuild from './builds/sha_default.build.json';
import ShaBuild from './builds/sha_encounter_only.build.json';
import P4BalancedBloodGear from './gear_sets/p4.gear.json';
import P4OffensiveBloodGear from './gear_sets/p4_offensive.gear.json';
import P4ProgBloodGear from './gear_sets/p4_prog.gear.json';
import P5BalancedBloodGear from './gear_sets/p5.gear.json';
import P5OffensiveBloodGear from './gear_sets/p5_offensive.gear.json';
import P5ProgBloodGear from './gear_sets/p5_prog.gear.json';
// import PreRaidBloodGear from './gear_sets/preraid.gear.json';
import P2BalancedEpJson from './presets/ep/p2_balanced.ep.json';
import P2OffensiveEpJson from './presets/ep/p2_offensive.ep.json';
import P3_4BalancedEpJson from './presets/ep/p3_4_balanced.ep.json';
import P3_4OffensiveEpJson from './presets/ep/p3_4_offensive.ep.json';
import P3_4SurvivalEpJson from './presets/ep/p3_4_survival.ep.json';
import P5BalancedEpJson from './presets/ep/p5_balanced.ep.json';
import P5OffensiveEpJson from './presets/ep/p5_offensive.ep.json';
import P5SurvivalEpJson from './presets/ep/p5_survival.ep.json';
import DefaultTalentsJson from './presets/talents/default.talents.json';

// export const PRERAID_BLOOD_PRESET = PresetUtils.makePresetGear('Pre-Raid', PreRaidBloodGear);
// export const P2_BALANCED_BLOOD_PRESET = PresetUtils.makePresetGear('P2 - BIS (Balanced)', P2BalancedBloodGear);
// export const P2_OFFENSIVE_BLOOD_PRESET = PresetUtils.makePresetGear('P2 - BIS (Offensive)', P2OffensiveBloodGear);
export const P3_4_PROG_BLOOD_PRESET = PresetUtils.makePresetGear('P3 & P4 - Prog (Survival)', P4ProgBloodGear);
export const P3_4_BALANCED_BLOOD_PRESET = PresetUtils.makePresetGear('P3 & P4 - BIS (Balanced)', P4BalancedBloodGear);
export const P3_4_OFFENSIVE_BLOOD_PRESET = PresetUtils.makePresetGear('P3 & P4 - BIS (Offensive)', P4OffensiveBloodGear);
export const P5_PROG_BLOOD_PRESET = PresetUtils.makePresetGear('P5 - Prog (Survival)', P5ProgBloodGear);
export const P5_BALANCED_BLOOD_PRESET = PresetUtils.makePresetGear('P5 - BIS (Balanced)', P5BalancedBloodGear);
export const P5_OFFENSIVE_BLOOD_PRESET = PresetUtils.makePresetGear('P5 - BIS (Offensive)', P5OffensiveBloodGear);

export const BLOOD_ROTATION_PRESET_SHA = PresetUtils.makePresetAPLRotation('Sha of Fear', ShaApl);
export const BLOOD_ROTATION_PRESET_HORRIDON = PresetUtils.makePresetAPLRotation('Horridon', HorridonApl);
export const BLOOD_ROTATION_PRESET_IRON_JUGGERNAUT = PresetUtils.makePresetAPLRotation('Iron Juggernaut', IronJuggernautApl);

// Preset options for EP weights
export const P2_BALANCED_EP_PRESET = PresetUtils.makePresetEpWeightsFromJSON(P2BalancedEpJson);

export const P2_OFFENSIVE_EP_PRESET = PresetUtils.makePresetEpWeightsFromJSON(P2OffensiveEpJson);

export const P3_4_SURVIVAL_EP_PRESET = PresetUtils.makePresetEpWeightsFromJSON(P3_4SurvivalEpJson);

export const P3_4_BALANCED_EP_PRESET = PresetUtils.makePresetEpWeightsFromJSON(P3_4BalancedEpJson);

export const P3_4_OFFENSIVE_EP_PRESET = PresetUtils.makePresetEpWeightsFromJSON(P3_4OffensiveEpJson);

export const P5_SURVIVAL_EP_PRESET = PresetUtils.makePresetEpWeightsFromJSON(P5SurvivalEpJson);

export const P5_BALANCED_EP_PRESET = PresetUtils.makePresetEpWeightsFromJSON(P5BalancedEpJson);

export const P5_OFFENSIVE_EP_PRESET = PresetUtils.makePresetEpWeightsFromJSON(P5OffensiveEpJson);

// Default talents. Uses the wowhead calculator format, make the talents on
// https://wowhead.com/mop-classic/talent-calc and copy the numbers in the url.

export const BloodTalents = PresetUtils.makePresetTalentsFromJSON(DefaultTalentsJson, {
	major: DeathKnightMajorGlyph,
	minor: DeathKnightMinorGlyph,
});

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
export const PRESET_BUILD_IRON_JUGGERNAUT = PresetUtils.makePresetBuildFromJSON('Iron Juggernaut P1', Spec.SpecBloodDeathKnight, IronJuggernautBuild);
