import * as PresetUtils from '@app/preset_utils';
import { ConsumesSpec, Profession } from '@generated/proto/common';
import { DisciplinePriest_Options as DisciplinePriestOptions, PriestMajorGlyph, PriestOptions_Armor } from '@generated/proto/priest';

import P5Gear from './gear_sets/p5.gear.json';
import PreraidGear from './gear_sets/preraid.gear.json';
import QELiveEpJson from './presets/ep/qe_live.ep.json';
import DefaultTalentsJson from './presets/talents/default.talents.json';

export const PRERAID_PRESET = PresetUtils.makePresetGear('Pre-raid', PreraidGear);
export const P5_PRESET = PresetUtils.makePresetGear('P5 BiS', P5Gear);

// Stat weights from QE Live's MoP Classic model, spell power = 1:
// https://github.com/Voulk/QuestionablyEpic/blob/dev/src/General/Modules/Player/ClassDefaults/Classic/Priest/DisciplinePriestClassic.js
// QE Live weights haste at 0 for Discipline and has no haste breakpoint for it either, so unlike
// Holy there is no haste soft cap in spec.ts and Suggest Reforges moves every point of haste into
// the other secondaries.
export const DEFAULT_EP_PRESET = PresetUtils.makePresetEpWeightsFromJSON(QELiveEpJson);

// Default talents. Uses the wowhead calculator format, make the talents on
// https://wowhead.com/mop-classic/talent-calc and copy the numbers in the url.
export const DefaultTalents = PresetUtils.makePresetTalentsFromJSON(DefaultTalentsJson, { major: PriestMajorGlyph });

export const DefaultOptions = DisciplinePriestOptions.create({
	classOptions: {
		armor: PriestOptions_Armor.InnerFire,
	},
});

export const DefaultConsumables = ConsumesSpec.create({
	flaskId: 76085, // Flask of the Warm Sun
	foodId: 74650, // Mogu Fish Stew
	potId: 76093, // Potion of the Jade Serpent
});

export const OtherDefaults = {
	profession1: Profession.Engineering,
	profession2: Profession.Leatherworking,
	distanceFromTarget: 18,
};
