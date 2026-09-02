import * as PresetUtils from '@app/preset_utils';

import { APLRotation_Type } from '../../core/proto/apl';
import { ConsumesSpec, Profession, Race, Spec } from '../../core/proto/common';
import { DeathKnightMajorGlyph, DeathKnightMinorGlyph, FrostDeathKnight_Options } from '../../core/proto/death_knight';
import MasterFrostAPL from '../../death_knight/frost/apls/masterfrost.apl.json';
import ObliterateAPL from '../../death_knight/frost/apls/obliterate.apl.json';
import P52hObliterateBuild from '../../death_knight/frost/builds/p5.2h-obliterate.build.json';
import P5MasterfrostBuild from '../../death_knight/frost/builds/p5.masterfrost.build.json';
import P52HObliterateGear from '../../death_knight/frost/gear_sets/p5.2h-obliterate.gear.json';
import P5MasterfrostGear from '../../death_knight/frost/gear_sets/p5.masterfrost.gear.json';
import Prebis2HObliterateGear from '../../death_knight/frost/gear_sets/prebis.2h-obliterate.gear.json';
import PrebisMasterfrostGear from '../../death_knight/frost/gear_sets/prebis.masterfrost.gear.json';
import TwohandObliterateEpJson from './presets/ep/2h_obliterate.ep.json';
import MasterfrostEpJson from './presets/ep/masterfrost.ep.json';
import DefaultTalentsJson from './presets/talents/default.talents.json';

export const P5_MASTERFROST_GEAR_PRESET = PresetUtils.makePresetGear('P5 - Masterfrost', P5MasterfrostGear);
export const P5_2H_OBLITERATE_GEAR_PRESET = PresetUtils.makePresetGear('P5 - 2h Obliterate', P52HObliterateGear);
export const PREBIS_MASTERFROST_GEAR_PRESET = PresetUtils.makePresetGear('Prebis - Masterfrost', PrebisMasterfrostGear);
export const PREBIS_2H_OBLITERATE_GEAR_PRESET = PresetUtils.makePresetGear('Prebis - 2h Obliterate', Prebis2HObliterateGear);

export const OBLITERATE_ROTATION_PRESET_DEFAULT = PresetUtils.makePresetAPLRotation('Obliterate', ObliterateAPL);
export const MASTERFROST_ROTATION_PRESET_DEFAULT = PresetUtils.makePresetAPLRotation('Masterfrost', MasterFrostAPL);

export const TWOHAND_OBLITERATE_EP_PRESET = PresetUtils.makePresetEpWeightsFromJSON(TwohandObliterateEpJson);

export const MASTERFROST_EP_PRESET = PresetUtils.makePresetEpWeightsFromJSON(MasterfrostEpJson);

// Default talents. Uses the wowhead calculator format, make the talents on
// https://wotlk.wowhead.com/talent-calc and copy the numbers in the url.

export const DefaultTalents = PresetUtils.makePresetTalentsFromJSON(DefaultTalentsJson, {
	major: DeathKnightMajorGlyph,
	minor: DeathKnightMinorGlyph,
});

export const DefaultOptions = FrostDeathKnight_Options.create({
	classOptions: {},
	amsNumTicks: 1,
});

export const OtherDefaults = {
	profession1: Profession.Engineering,
	profession2: Profession.Herbalism,
	distanceFromTarget: 5,
	race: Race.RaceTroll,
	iterationCount: 25000,
};

export const DefaultConsumables = ConsumesSpec.create({
	flaskId: 76088, // Flask of Winter's Bite
	foodId: 74646, // Black Pepper Ribs and Shrimp
	potId: 76095, // Potion of Mogu Power
	prepotId: 76095, // Potion of Mogu Power
});

export const PRESET_BUILD_P5_2H_OBLITERATE = PresetUtils.makePresetBuildFromJSON('P5 - 2h Obliterate', Spec.SpecFrostDeathKnight, P52hObliterateBuild, {
	epWeights: TWOHAND_OBLITERATE_EP_PRESET,
	rotationType: APLRotation_Type.TypeAuto,
});
export const PRESET_BUILD_P5_MASTERFROST = PresetUtils.makePresetBuildFromJSON('P5 - Masterfrost', Spec.SpecFrostDeathKnight, P5MasterfrostBuild, {
	epWeights: MASTERFROST_EP_PRESET,
	rotationType: APLRotation_Type.TypeAuto,
});
