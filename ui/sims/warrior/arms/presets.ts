import * as PresetUtils from '@app/preset_utils';
import { ConsumesSpec, Profession, Race } from '@generated/proto/common';
import { ArmsWarrior_Options as WarriorOptions, WarriorMajorGlyph } from '@generated/proto/warrior';

import ArmsApl from './apls/arms.apl.json';
import P2ArmsBisGear from './gear_sets/p2_arms_bis.gear.json';
import P4ArmsBisGear from './gear_sets/p4_arms_bis.gear.json';
import P5ArmsBisGear from './gear_sets/p5_arms_bis.gear.json';
import PreBisGear from './gear_sets/prebis.gear.json';
import ArmsP1EpJson from './presets/ep/p1.ep.json';
import ArmsP2EpJson from './presets/ep/p2.ep.json';
import ArmsP5EpJson from './presets/ep/p5.ep.json';
import ArmsDefaultTalentsJson from './presets/talents/default.talents.json';

// Preset options for this spec.
// Eventually we will import these values for the raid sim too, so its good to
// keep them in a separate file.

export const PREBIS_PRESET = PresetUtils.makePresetGear('Pre-BIS', PreBisGear);
export const P2_ARMS_BIS_PRESET = PresetUtils.makePresetGear('P2 - BIS', P2ArmsBisGear);
export const P3_4_ARMS_BIS_PRESET = PresetUtils.makePresetGear('P3 & P4 - BIS', P4ArmsBisGear);
export const P5_ARMS_BIS_PRESET = PresetUtils.makePresetGear('P5 - BIS', P5ArmsBisGear);

export const ROTATION_ARMS = PresetUtils.makePresetAPLRotation('Default', ArmsApl);

// Preset options for EP weights
export const P1_EP_PRESET = PresetUtils.makePresetEpWeightsFromJSON(ArmsP1EpJson);

export const P2_EP_PRESET = PresetUtils.makePresetEpWeightsFromJSON(ArmsP2EpJson);

export const P5_EP_PRESET = PresetUtils.makePresetEpWeightsFromJSON(ArmsP5EpJson);

// Default talents. Uses the wowhead calculator format, make the talents on
// https://wowhead.com/wotlk/talent-calc and copy the numbers in the url.

export const ArmsTalents = PresetUtils.makePresetTalentsFromJSON(ArmsDefaultTalentsJson, { major: WarriorMajorGlyph });

export const DefaultOptions = WarriorOptions.create({
	classOptions: {},
});

export const DefaultConsumables = ConsumesSpec.create({
	flaskId: 76088, // Flask of Winter's Bite
	foodId: 74646, // Black Pepper Ribs and Shrimp
	potId: 76095, // Potion of Mogu Power
	prepotId: 76095, // Potion of Mogu Power
});

export const OtherDefaults = {
	race: Race.RaceOrc,
	profession1: Profession.Engineering,
	profession2: Profession.Blacksmithing,
	distanceFromTarget: 25,
};
