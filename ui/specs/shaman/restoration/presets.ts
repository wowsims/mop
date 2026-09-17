import * as PresetUtils from '@app/preset_utils';
import { ConsumesSpec, Profession, PseudoStat } from '@generated/proto/common';
import { RestorationShaman_Options as RestorationShamanOptions, ShamanMajorGlyph, ShamanMinorGlyph, ShamanShield } from '@generated/proto/shaman';
import { UnitStat, UnitStatPresets } from '@sim/proto/stats';

import P5Gear from './gear_sets/p5.gear.json';
import PreraidGear from './gear_sets/preraid.gear.json';
import QELiveEpJson from './presets/ep/qe_live.ep.json';
import DefaultTalentsJson from './presets/talents/default.talents.json';

export const PRERAID_PRESET = PresetUtils.makePresetGear('Pre-raid', PreraidGear);
export const P5_PRESET = PresetUtils.makePresetGear('P5 BiS', P5Gear);

// Stat weights from QE Live's MoP Classic model, spell power = 1:
// https://github.com/Voulk/QuestionablyEpic/blob/dev/src/General/Modules/Player/ClassDefaults/Classic/Shaman/RestoShamanClassic.js
export const DEFAULT_EP_PRESET = PresetUtils.makePresetEpWeightsFromJSON(QELiveEpJson);

// Default talents. Uses the wowhead calculator format, make the talents on
// https://wowhead.com/mop-classic/talent-calc and copy the numbers in the url.
export const DefaultTalents = PresetUtils.makePresetTalentsFromJSON(DefaultTalentsJson, { major: ShamanMajorGlyph, minor: ShamanMinorGlyph });

export const DefaultOptions = RestorationShamanOptions.create({
	classOptions: {
		shield: ShamanShield.WaterShield,
	},
	earthShieldPPM: 0,
});

export const DefaultConsumables = ConsumesSpec.create({
	flaskId: 76085, // Flask of the Warm Sun
	foodId: 74650, // Mogu Fish Stew
	potId: 76093, // Potion of the Jade Serpent
});

export const OtherDefaults = {
	profession1: Profession.Engineering,
	profession2: Profession.Tailoring,
	distanceFromTarget: 18,
};

// HoT tick breakpoints as total spell haste percent (raid buff included):
// (ticks - 0.5) / baseTicks - 1. Riptide 18s/3s, Earthliving 12s/3s.
export const QE_HASTE_EP_PAST_BREAKPOINT = 0.687;

export const RESTORATION_BREAKPOINTS: UnitStatPresets[] = [
	{
		unitStat: UnitStat.fromPseudoStat(PseudoStat.PseudoStatSpellHastePercent),
		presets: new Map([
			['7-tick - Riptide', 8.33334],
			['5-tick - Earthliving', 12.5],
			['8-tick - Riptide', 25],
			['6-tick - Earthliving', 37.5],
			['9-tick - Riptide', 41.66667],
			['10-tick - Riptide', 58.33334],
		]),
	},
];
