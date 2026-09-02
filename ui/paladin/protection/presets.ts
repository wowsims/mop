import * as PresetUtils from '@app/preset_utils';

import { ConsumesSpec, Profession, Spec } from '../../core/proto/common';
import { PaladinMajorGlyph, PaladinMinorGlyph, PaladinSeal, ProtectionPaladin_Options as ProtectionPaladinOptions } from '../../core/proto/paladin';
import HorridonApl from './apls/horridon.apl.json';
import IronJuggernautApl from './apls/iron_juggernaut.apl.json';
import ShaApl from './apls/sha.apl.json';
import HorridonBuild from './builds/horridon_encounter_only.build.json';
import IronJuggernautBuild from './builds/iron_juggernaut_encounter_only.build.json';
import DefaultBuild from './builds/sha_default.build.json';
import ShaBuild from './builds/sha_encounter_only.build.json';
import P2_Balanced_Gear from './gear_sets/p2_balanced.gear.json';
import P2_Offensive_Gear from './gear_sets/p2_offensive.gear.json';
import P4_Balanced_Gear from './gear_sets/p4_balanced.gear.json';
import P4_Offensive_Gear from './gear_sets/p4_offensive.gear.json';
import P5_Balanced_Gear from './gear_sets/p5_balanced.gear.json';
import P5_Offensive_Gear from './gear_sets/p5_offensive.gear.json';
import P5_Prog_Gear from './gear_sets/p5_prog.gear.json';
import P2BalancedEpJson from './presets/ep/p2_balanced.ep.json';
import P2OffensiveEpJson from './presets/ep/p2_offensive.ep.json';
import P34BalancedEpJson from './presets/ep/p3_4_balanced.ep.json';
import P34OffensiveEpJson from './presets/ep/p3_4_offensive.ep.json';
import P5BalancedEpJson from './presets/ep/p5_balanced.ep.json';
import P5OffensiveEpJson from './presets/ep/p5_offensive.ep.json';
import DefaultTalentsJson from './presets/talents/default.talents.json';

// Preset options for this spec.
// Eventually we will import these values for the raid sim too, so its good to
// keep them in a separate file.

export const P2_BALANCED_GEAR_PRESET = PresetUtils.makePresetGear('P2 - BIS (Balanced)', P2_Balanced_Gear);
export const P2_OFFENSIVE_GEAR_PRESET = PresetUtils.makePresetGear('P2 - BIS (Offensive)', P2_Offensive_Gear);
export const P3_4_BALANCED_GEAR_PRESET = PresetUtils.makePresetGear('P3 & P4 - BIS (Balanced)', P4_Balanced_Gear);
export const P3_4_OFFENSIVE_GEAR_PRESET = PresetUtils.makePresetGear('P3 & P4 - BIS (Offensive)', P4_Offensive_Gear);
export const P5_PROG_GEAR_PRESET = PresetUtils.makePresetGear('P5 - Prog (Balanced)', P5_Prog_Gear);
export const P5_BALANCED_GEAR_PRESET = PresetUtils.makePresetGear('P5 - BIS (Balanced)', P5_Balanced_Gear);
export const P5_OFFENSIVE_GEAR_PRESET = PresetUtils.makePresetGear('P5 - BIS (Offensive)', P5_Offensive_Gear);

export const APL_SHA_PRESET = PresetUtils.makePresetAPLRotation('Sha of Fear', ShaApl);
export const APL_HORRIDON_PRESET = PresetUtils.makePresetAPLRotation('Horridon', HorridonApl);
export const APL_IRON_JUGGERNAUT_PRESET = PresetUtils.makePresetAPLRotation('Iron Juggernaut', IronJuggernautApl);

// Preset options for EP weights
export const P2_BALANCED_EP_PRESET = PresetUtils.makePresetEpWeightsFromJSON(P2BalancedEpJson);

export const P2_OFFENSIVE_EP_PRESET = PresetUtils.makePresetEpWeightsFromJSON(P2OffensiveEpJson);

export const P3_4_BALANCED_EP_PRESET = PresetUtils.makePresetEpWeightsFromJSON(P34BalancedEpJson);

export const P3_4_OFFENSIVE_EP_PRESET = PresetUtils.makePresetEpWeightsFromJSON(P34OffensiveEpJson);

export const P5_BALANCED_EP_PRESET = PresetUtils.makePresetEpWeightsFromJSON(P5BalancedEpJson);

export const P5_OFFENSIVE_EP_PRESET = PresetUtils.makePresetEpWeightsFromJSON(P5OffensiveEpJson);

// Default talents. Uses the wowhead calculator format, make the talents on
// https://wowhead.com/mop-classic/talent-calc and copy the numbers in the url.

export const DefaultTalents = PresetUtils.makePresetTalentsFromJSON(DefaultTalentsJson, { major: PaladinMajorGlyph, minor: PaladinMinorGlyph });

export const P4_BALANCED_BUILD_PRESET = PresetUtils.makePresetBuild('P4 Gear/EPs/Talents (Horridon)', {
	gear: P3_4_BALANCED_GEAR_PRESET,
	epWeights: P3_4_BALANCED_EP_PRESET,
	talents: DefaultTalents,
});
export const PRESET_BUILD_DEFAULT = PresetUtils.makePresetBuildFromJSON('Default', Spec.SpecProtectionPaladin, DefaultBuild);
export const PRESET_BUILD_SHA = PresetUtils.makePresetBuildFromJSON('Sha of Fear P2', Spec.SpecProtectionPaladin, ShaBuild);
export const PRESET_BUILD_HORRIDON = PresetUtils.makePresetBuildFromJSON('Horridon P2', Spec.SpecProtectionPaladin, HorridonBuild);
export const PRESET_BUILD_IRON_JUGGERNAUT = PresetUtils.makePresetBuildFromJSON('Iron Juggernaut P1', Spec.SpecProtectionPaladin, IronJuggernautBuild);

export const DefaultOptions = ProtectionPaladinOptions.create({
	classOptions: {
		seal: PaladinSeal.Insight,
	},
});

export const DefaultConsumables = ConsumesSpec.create({
	flaskId: 76087, // Flask of the Earth
	foodId: 74656, // Chun Tian Spring Rolls
	potId: 76095, // Potion of Mogu Power
	prepotId: 76095, // Potion of Mogu Power
});

export const OtherDefaults = {
	profession1: Profession.Blacksmithing,
	profession2: Profession.Engineering,
	distanceFromTarget: 5,
	iterationCount: 25000,
};
