import * as PresetUtils from '@app/preset_utils';
import { ConsumesSpec, Profession, PseudoStat } from '@generated/proto/common';
import { HolyPriest_Options as HolyPriestOptions, PriestMajorGlyph, PriestOptions_Armor } from '@generated/proto/priest';
import { UnitStat, UnitStatPresets } from '@sim/proto/stats';

import P5Gear from './gear_sets/p5.gear.json';
import PreraidGear from './gear_sets/preraid.gear.json';
import QELiveEpJson from './presets/ep/qe_live.ep.json';
import DefaultTalentsJson from './presets/talents/default.talents.json';

export const PRERAID_PRESET = PresetUtils.makePresetGear('Pre-raid', PreraidGear);
export const P5_PRESET = PresetUtils.makePresetGear('P5 BiS', P5Gear);

// Stat weights from QE Live's MoP Classic model, spell power = 1:
// https://github.com/Voulk/QuestionablyEpic/blob/dev/src/General/Modules/Player/ClassDefaults/Classic/Priest/HolyPriestClassic.js
// QE Live weights haste at 0 and reforges to the 5-tick Renew breakpoint separately. Haste sits just
// above mastery here so the reforge optimizer reaches that breakpoint too; past the threshold it
// falls back to QE's 0 (see the haste threshold in spec.ts).
export const DEFAULT_EP_PRESET = PresetUtils.makePresetEpWeightsFromJSON(QELiveEpJson);

// Default talents. Uses the wowhead calculator format, make the talents on
// https://wowhead.com/mop-classic/talent-calc and copy the numbers in the url.
export const DefaultTalents = PresetUtils.makePresetTalentsFromJSON(DefaultTalentsJson, { major: PriestMajorGlyph });

export const DefaultOptions = HolyPriestOptions.create({
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
	profession2: Profession.Enchanting,
	distanceFromTarget: 18,
};

// HoT tick breakpoints as total spell haste percent (raid buff included):
// (ticks - 0.5) / baseTicks - 1. Renew 12s/3s, Holy Word: Sanctuary 30s/2s.
export const QE_HASTE_EP_PAST_BREAKPOINT = 0;

export const HOLY_BREAKPOINTS: UnitStatPresets[] = [
	{
		unitStat: UnitStat.fromPseudoStat(PseudoStat.PseudoStatSpellHastePercent),
		presets: new Map([
			['16-tick - Sanctuary', 3.33334],
			['17-tick - Sanctuary', 10],
			['5-tick - Renew', 12.5],
			['18-tick - Sanctuary', 16.66667],
			['19-tick - Sanctuary', 23.33334],
			['20-tick - Sanctuary', 30],
			['6-tick - Renew', 37.5],
			['7-tick - Renew', 62.5],
		]),
	},
];
