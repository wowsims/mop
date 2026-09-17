import * as PresetUtils from '@app/preset_utils';
import { ConsumesSpec, Profession, PseudoStat } from '@generated/proto/common';
import { HolyPaladin_Options as HolyPaladinOptions, PaladinMajorGlyph, PaladinMinorGlyph, PaladinSeal } from '@generated/proto/paladin';
import { UnitStat, UnitStatPresets } from '@sim/proto/stats';

import P5Gear from './gear_sets/p5.gear.json';
import PreraidGear from './gear_sets/preraid.gear.json';
import QELiveEpJson from './presets/ep/qe_live.ep.json';
import DefaultTalentsJson from './presets/talents/default.talents.json';

export const PRERAID_PRESET = PresetUtils.makePresetGear('Pre-raid', PreraidGear);
export const P5_PRESET = PresetUtils.makePresetGear('P5 BiS', P5Gear);

// Stat weights from QE Live's MoP Classic model, spell power = 1:
// https://github.com/Voulk/QuestionablyEpic/blob/dev/src/General/Modules/Player/ClassDefaults/Classic/Paladin/HolyPaladinClassic.js
export const DEFAULT_EP_PRESET = PresetUtils.makePresetEpWeightsFromJSON(QELiveEpJson);

// Default talents. Uses the wowhead calculator format, make the talents on
// https://wowhead.com/mop-classic/talent-calc and copy the numbers in the url.
export const DefaultTalents = PresetUtils.makePresetTalentsFromJSON(DefaultTalentsJson, { major: PaladinMajorGlyph, minor: PaladinMinorGlyph });

export const DefaultOptions = HolyPaladinOptions.create({
	classOptions: {
		seal: PaladinSeal.Insight,
	},
});

export const DefaultConsumables = ConsumesSpec.create({
	flaskId: 76085, // Flask of the Warm Sun
	foodId: 74650, // Mogu Fish Stew
	potId: 76093, // Potion of the Jade Serpent
});

export const OtherDefaults = {
	profession1: Profession.Engineering,
	profession2: Profession.Jewelcrafting,
	distanceFromTarget: 18,
};

// HoT tick breakpoints as total spell haste percent (raid buff included):
// (ticks - 0.5) / baseTicks - 1. Eternal Flame 30s/3s, Sacred Shield 30s/6s.
export const QE_HASTE_EP_PAST_BREAKPOINT = 0.527;

export const HOLY_BREAKPOINTS: UnitStatPresets[] = [
	{
		unitStat: UnitStat.fromPseudoStat(PseudoStat.PseudoStatSpellHastePercent),
		presets: new Map([
			['11-tick - Eternal Flame', 5],
			['6-tick - Sacred Shield', 10],
			['12-tick - Eternal Flame', 15],
			['13-tick - Eternal Flame', 25],
			['7-tick - Sacred Shield', 30],
			['14-tick - Eternal Flame', 35],
			['15-tick - Eternal Flame', 45],
			['8-tick - Sacred Shield', 50],
		]),
	},
];
