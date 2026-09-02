import * as PresetUtils from '@app/preset_utils';
import { ConsumesSpec } from '@core/proto/common';
import { AssassinationRogue_Options as RogueOptions, RogueMajorGlyph, RogueOptions_PoisonOptions } from '@core/proto/rogue';

import AssassinationApl from './apls/assassination.apl.json';
import P2Gear from './gear_sets/p2_assassination.gear.json';
import P3Gear from './gear_sets/p3_assassination.gear.json';
import P5Gear from './gear_sets/p5_assassination.gear.json';
import PreraidGear from './gear_sets/preraid_assassination.gear.json';
import AsnEpJson from './presets/ep/asn.ep.json';
import AssassinationTalentsJson from './presets/talents/assassination.talents.json';

// Preset options for this spec.
// Eventually we will import these values for the raid sim too, so its good to
// keep them in a separate file.

export const PRERAID_GEARSET = PresetUtils.makePresetGear('P1 Preraid', PreraidGear);
export const P2_GEARSET = PresetUtils.makePresetGear('P2', P2Gear);
export const P3_GEARSET = PresetUtils.makePresetGear('P3', P3Gear);
export const P5_GEARSET = PresetUtils.makePresetGear('P5', P5Gear);

export const ROTATION_PRESET_ASSASSINATION = PresetUtils.makePresetAPLRotation('Assassination', AssassinationApl);

// Preset options for EP weights
export const ASN_EP_PRESET = PresetUtils.makePresetEpWeightsFromJSON(AsnEpJson);

// Default talents. Uses the wowhead calculator format, make the talents on
// https://wowhead.com/mop-classic/talent-calc and copy the numbers in the url.

export const AssassinationTalentsDefault = PresetUtils.makePresetTalentsFromJSON(AssassinationTalentsJson, { major: RogueMajorGlyph });

export const DefaultOptions = RogueOptions.create({
	classOptions: {
		lethalPoison: RogueOptions_PoisonOptions.DeadlyPoison,
		applyPoisonsManually: false,
		startingOverkillDuration: 20,
		vanishBreakTime: 0.1,
	},
});

export const DefaultConsumables = ConsumesSpec.create({
	flaskId: 76084, // Flask of the Winds
	foodId: 74648, // Skewered Eel
	potId: 76089, // Potion of the Tol'vir
	prepotId: 76089, // Potion of the Tol'vir
});

export const OtherDefaults = {
	distanceFromTarget: 5,
};
