import * as PresetUtils from '@app/preset_utils';
import { ConsumesSpec, Profession, Spec } from '@generated/proto/common';
import { ProtectionWarrior_Options as ProtectionWarriorOptions, WarriorMajorGlyph } from '@generated/proto/warrior';

import GenericApl from './apls/default.apl.json';
import GarajalApl from './apls/garajal.apl.json';
import HorridonApl from './apls/horridon.apl.json';
import IronJuggernautApl from './apls/iron_juggernaut.apl.json';
import ShaApl from './apls/sha.apl.json';
import GarajalBuild from './builds/garajal_encounter_only.build.json';
import HorridonBuild from './builds/horridon_encounter_only.build.json';
import IronJuggernautBuild from './builds/iron_juggernaut_encounter_only.build.json';
import ShaBuild from './builds/sha_encounter_only.build.json';
import PreRaidItemSwapGear from './gear_sets/p1_preraid_item_swap.gear.json';
import P2BISGear from './gear_sets/p2_bis.gear.json';
import P2BISItemSwapGear from './gear_sets/p2_bis_item_swap.gear.json';
import P2BISOffensiveGear from './gear_sets/p2_bis_offensive.gear.json';
import P4BISGear from './gear_sets/p4_bis.gear.json';
import P4BISOffensiveGear from './gear_sets/p4_bis_offensive.gear.json';
import P4ProgGear from './gear_sets/p4_prog.gear.json';
import P5BISGear from './gear_sets/p5_bis.gear.json';
import P5BISOffensiveGear from './gear_sets/p5_bis_offensive.gear.json';
import P5ProgGear from './gear_sets/p5_prog.gear.json';
import PreraidBISGear from './gear_sets/preraid.gear.json';
import P2EpJson from './presets/ep/p2.ep.json';
import P2OffensiveEpJson from './presets/ep/p2_offensive.ep.json';
import P3EpJson from './presets/ep/p3.ep.json';
import P3OffensiveEpJson from './presets/ep/p3_offensive.ep.json';
import P5EpJson from './presets/ep/p5.ep.json';
import P5OffensiveEpJson from './presets/ep/p5_offensive.ep.json';
import StandardTalentsJson from './presets/talents/standard.talents.json';

// Preset options for this spec.
// Eventually we will import these values for the raid sim too, so its good to
// keep them in a separate file.

export const PRERAID_BALANCED_PRESET = PresetUtils.makePresetGear('Pre-BIS', PreraidBISGear);
export const P2_BALANCED_PRESET = PresetUtils.makePresetGear('P2 - BIS', P2BISGear);
export const P2_OFFENSIVE_PRESET = PresetUtils.makePresetGear('P2 - BIS (Offensive)', P2BISOffensiveGear);
export const P3_4_PROG_PRESET = PresetUtils.makePresetGear('P3 & P4 - Prog (Balanced)', P4ProgGear);
export const P3_4_BALANCED_PRESET = PresetUtils.makePresetGear('P3 & P4 - BIS (Balanced)', P4BISGear);
export const P3_4_OFFENSIVE_PRESET = PresetUtils.makePresetGear('P3 & P4 - BIS (Offensive)', P4BISOffensiveGear);
export const P5_PROG_PRESET = PresetUtils.makePresetGear('P5 - Prog (Balanced)', P5ProgGear);
export const P5_BALANCED_PRESET = PresetUtils.makePresetGear('P5 - BIS (Balanced)', P5BISGear);
export const P5_OFFENSIVE_PRESET = PresetUtils.makePresetGear('P5 - BIS (Offensive)', P5BISOffensiveGear);

export const PRERAID_ITEM_SWAP = PresetUtils.makePresetItemSwapGear('Pre-raid - Item Swap', PreRaidItemSwapGear);
export const P2_ITEM_SWAP = PresetUtils.makePresetItemSwapGear('P2 - Item Swap', P2BISItemSwapGear);

export const ROTATION_GENERIC = PresetUtils.makePresetAPLRotation('Generic', GenericApl);
export const ROTATION_GARAJAL = PresetUtils.makePresetAPLRotation("Gara'jal", GarajalApl);
export const ROTATION_SHA = PresetUtils.makePresetAPLRotation('Sha of Fear', ShaApl);
export const ROTATION_HORRIDON = PresetUtils.makePresetAPLRotation('Horridon', HorridonApl);
export const ROTATION_IRON_JUGGERNAUT = PresetUtils.makePresetAPLRotation('Iron Juggernaut', IronJuggernautApl);

// Preset options for EP weights
export const P2_EP_PRESET = PresetUtils.makePresetEpWeightsFromJSON(P2EpJson);

export const P2_OFFENSIVE_EP_PRESET = PresetUtils.makePresetEpWeightsFromJSON(P2OffensiveEpJson);

export const P3_EP_PRESET = PresetUtils.makePresetEpWeightsFromJSON(P3EpJson);

export const P3_OFFENSIVE_EP_PRESET = PresetUtils.makePresetEpWeightsFromJSON(P3OffensiveEpJson);

export const P5_EP_PRESET = PresetUtils.makePresetEpWeightsFromJSON(P5EpJson);

export const P5_OFFENSIVE_EP_PRESET = PresetUtils.makePresetEpWeightsFromJSON(P5OffensiveEpJson);

// Default talents. Uses the wowhead calculator format, make the talents on
// https://wowhead.com/mop-classic/talent-calc and copy the numbers in the url.
export const StandardTalents = PresetUtils.makePresetTalentsFromJSON(StandardTalentsJson, { major: WarriorMajorGlyph });

export const DefaultOptions = ProtectionWarriorOptions.create({
	classOptions: {},
});

export const DefaultConsumables = ConsumesSpec.create({
	flaskId: 76087, // Flask of the Earth
	foodId: 74656, // Chun Tian Spring Rolls
	prepotId: 76090, // Potion of the Mountains
	potId: 76090, // Potion of the Mountains
	conjuredId: 5512, // Healthstone
});

export const OtherDefaults = {
	profession1: Profession.Engineering,
	profession2: Profession.Blacksmithing,
	distanceFromTarget: 15,
};

export const PRESET_BUILD_GARAJAL = PresetUtils.makePresetBuildFromJSON("Gara'jal", Spec.SpecProtectionWarrior, GarajalBuild);
export const PRESET_BUILD_SHA = PresetUtils.makePresetBuildFromJSON('Sha of Fear P2', Spec.SpecProtectionWarrior, ShaBuild);
export const PRESET_BUILD_HORRIDON = PresetUtils.makePresetBuildFromJSON('Horridon P2', Spec.SpecProtectionWarrior, HorridonBuild);
export const PRESET_BUILD_IRON_JUGGERNAUT = PresetUtils.makePresetBuildFromJSON('Iron Juggernaut P1', Spec.SpecProtectionWarrior, IronJuggernautBuild);

// const TEMP_P3_STATIC_ENCOUNTER = PresetUtils.makePresetEncounter('P3', {
// 	...Encounter.defaultEncounterProto(),
// 	targets: [
// 		{
// 			...Encounter.defaultTargetProto(),
// 			minBaseDamage: 950000,
// 		},
// 	],
// });

// export const PRESET_BUILD_P3_BIS_OFFENSIVE = PresetUtils.makePresetBuild('P3 - BIS - Offensive (TBD)', {
// 	gear: P3_OFFENSIVE_PRESET,
// 	talents: StandardTalents,
// 	rotation: ROTATION_GENERIC,
// 	settings: {
// 		name: 'P3 - BIS',
// 		consumables: ConsumesSpec.create({
// 			...DefaultConsumables,
// 			flaskId: undefined,
// 			battleElixirId: 76076, // Mad Hozen Elixir
// 			guardianElixirId: 76081, // Elixir of Mirrors
// 			foodId: 74646, // Black Pepper Rib and Shrimp
// 			prepotId: 76095, // Potion of Mogu Power
// 			potId: 76095, // Potion of Mogu Power
// 			conjuredId: 5512, // Healthstone
// 		}),
// 	},
// 	encounter: TEMP_P3_STATIC_ENCOUNTER,
// });

// export const PRESET_BUILD_P3_BIS = PresetUtils.makePresetBuild('P3 - BIS (TBD)', {
// 	gear: P3_BALANCED_PRESET,
// 	talents: StandardTalents,
// 	rotation: ROTATION_GENERIC,
// 	settings: {
// 		name: 'P3 - BIS',
// 		consumables: ConsumesSpec.create({
// 			...DefaultConsumables,
// 			flaskId: undefined,
// 			battleElixirId: 76076, // Mad Hozen Elixir
// 			guardianElixirId: 76081, // Elixir of Mirrors
// 		}),
// 	},
// 	encounter: TEMP_P3_STATIC_ENCOUNTER,
// });
