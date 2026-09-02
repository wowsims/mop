import * as PresetUtils from '@app/preset_utils';
import { ConsumesSpec, Profession, Spec } from '@generated/proto/common';
import { BrewmasterMonk_Options as BrewmasterMonkOptions, MonkMajorGlyph, MonkMinorGlyph } from '@generated/proto/monk';

import DefaultApl from './apls/default.apl.json';
import HorridonApl from './apls/horridon.apl.json';
import IronJuggernautApl from './apls/iron_juggernaut.apl.json';
import OffensiveApl from './apls/offensive.apl.json';
import HorridonBuild from './builds/horridon_encounter_only.build.json';
import IronJuggernautBuild from './builds/iron_juggernaut_encounter_only.build.json';
import P4BISDWGear from './gear_sets/p4_bis_dw.gear.json';
import P4BISOffensiveDWGear from './gear_sets/p4_bis_offensive_dw.gear.json';
import P5BISDWGear from './gear_sets/p5_bis_dw.gear.json';
import P5BISOffensiveDWGear from './gear_sets/p5_bis_offensive_dw.gear.json';
import P5ProgDWGear from './gear_sets/p5_prog_dw.gear.json';
import PreBISGear from './gear_sets/prebis.gear.json';
import P2BalancedEpJson from './presets/ep/p2_balanced.ep.json';
import P2OffensiveEpJson from './presets/ep/p2_offensive.ep.json';
import P34BalancedEpJson from './presets/ep/p3_4_balanced.ep.json';
import P34OffensiveEpJson from './presets/ep/p3_4_offensive.ep.json';
import P5BalancedEpJson from './presets/ep/p5_balanced.ep.json';
import P5OffensiveEpJson from './presets/ep/p5_offensive.ep.json';
import DefaultTalentsJson from './presets/talents/default.talents.json';
import DungeonTalentsJson from './presets/talents/dungeon.talents.json';

// Preset options for this spec.
// Eventually we will import these values for the raid sim too, so its good to
// keep them in a separate file.

export const PREBIS_GEAR_PRESET = PresetUtils.makePresetGear('Pre-BIS (Balanced)', PreBISGear);
// export const P1_BIS_DW_GEAR_PRESET = PresetUtils.makePresetGear('P1 - BIS (Balanced)', P1BISDWGear);
// export const P2_BIS_DW_GEAR_PRESET = PresetUtils.makePresetGear('P2 - BIS (Balanced)', P2BISDWGear);
// export const P2_BIS_OFFENSIVE_DW_GEAR_PRESET = PresetUtils.makePresetGear('P2 - BIS (Offensive - 2PC)', P2BISOffensiveDWGear);
// export const P2_BIS_OFFENSIVE_TIERLESS_DW_GEAR_PRESET = PresetUtils.makePresetGear('P2 - BIS (Offensive - No Tier)', P2BISOffensiveTierlessDWGear);
export const P3_4_BIS_DW_GEAR_PRESET = PresetUtils.makePresetGear('P3 & P4 - BIS (Balanced)', P4BISDWGear);
export const P3_4_BIS_OFFENSIVE_DW_GEAR_PRESET = PresetUtils.makePresetGear('P3 & P4 - BIS (Offensive)', P4BISOffensiveDWGear);
export const P5_PROG_DW_GEAR_PRESET = PresetUtils.makePresetGear('P5 - Prog (Balanced)', P5ProgDWGear);
export const P5_BIS_DW_GEAR_PRESET = PresetUtils.makePresetGear('P5 - BIS (Balanced)', P5BISDWGear);
export const P5_BIS_OFFENSIVE_DW_GEAR_PRESET = PresetUtils.makePresetGear('P5 - BIS (Offensive)', P5BISOffensiveDWGear);

export const ROTATION_PRESET = PresetUtils.makePresetAPLRotation('Generic', DefaultApl);
export const ROTATION_OFFENSIVE_PRESET = PresetUtils.makePresetAPLRotation('Offensive', OffensiveApl);
// export const ROTATION_GARAJAL_PRESET = PresetUtils.makePresetAPLRotation("Gara'jal", GarajalApl);
// export const ROTATION_SHA_PRESET = PresetUtils.makePresetAPLRotation('Sha of Fear', ShaApl);
export const ROTATION_HORRIDON_PRESET = PresetUtils.makePresetAPLRotation('Horridon', HorridonApl);
export const ROTATION_IRON_JUGGERNAUT_PRESET = PresetUtils.makePresetAPLRotation('Iron Juggernaut', IronJuggernautApl);

// Preset options for EP weights
export const P2_BALANCED_EP_PRESET = PresetUtils.makePresetEpWeightsFromJSON(P2BalancedEpJson);

export const P2_OFFENSIVE_EP_PRESET = PresetUtils.makePresetEpWeightsFromJSON(P2OffensiveEpJson);

export const P3_4_BALANCED_EP_PRESET = PresetUtils.makePresetEpWeightsFromJSON(P34BalancedEpJson);

export const P3_4_OFFENSIVE_EP_PRESET = PresetUtils.makePresetEpWeightsFromJSON(P34OffensiveEpJson);

export const P5_BALANCED_EP_PRESET = PresetUtils.makePresetEpWeightsFromJSON(P5BalancedEpJson);

export const P5_OFFENSIVE_EP_PRESET = PresetUtils.makePresetEpWeightsFromJSON(P5OffensiveEpJson);

// Default talents. Uses the wowhead calculator format, make the talents on
// https://wowhead.com/mop/talent-calc and copy the numbers in the url.

export const DefaultTalents = PresetUtils.makePresetTalentsFromJSON(DefaultTalentsJson, { major: MonkMajorGlyph, minor: MonkMinorGlyph });

export const DungeonTalents = PresetUtils.makePresetTalentsFromJSON(DungeonTalentsJson, { major: MonkMajorGlyph, minor: MonkMinorGlyph });

export const DefaultOptions = BrewmasterMonkOptions.create({
	classOptions: {},
});

export const DefaultConsumables = ConsumesSpec.create({
	flaskId: 76087, // Flask of Spring Blossoms
	foodId: 74648, // Sea Mist Rice Noodles
	prepotId: 76090, // Potion of the Mountains
	potId: 76090, // Potion of the Mountains
	conjuredId: 5512, // Healthstone
});

export const OffensiveConsumables = ConsumesSpec.create({
	...DefaultConsumables,
	prepotId: 76089, // Virmen's Bite
	potId: 76089, // Virmen's Bite
});

export const OtherDefaults = {
	profession1: Profession.Engineering,
	profession2: Profession.Blacksmithing,
	distanceFromTarget: 5,
	iterationCount: 25000,
};

// export const PRESET_BUILD_GARAJAL = PresetUtils.makePresetBuildFromJSON("Gara'jal", Spec.SpecBrewmasterMonk, GarajalBuild);
// export const PRESET_BUILD_SHA = PresetUtils.makePresetBuildFromJSON('Sha of Fear P2', Spec.SpecBrewmasterMonk, ShaBuild);
export const PRESET_BUILD_HORRIDON = PresetUtils.makePresetBuildFromJSON('Horridon P2', Spec.SpecBrewmasterMonk, HorridonBuild);
export const PRESET_BUILD_IRON_JUGGERNAUT = PresetUtils.makePresetBuildFromJSON('Iron Juggernaut P1', Spec.SpecBrewmasterMonk, IronJuggernautBuild);
