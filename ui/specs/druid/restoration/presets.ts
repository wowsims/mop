import * as PresetUtils from '@app/preset_utils';
import { ConsumesSpec, Profession, PseudoStat, UnitReference } from '@generated/proto/common';
import { DruidMajorGlyph, RestorationDruid_Options as RestorationDruidOptions } from '@generated/proto/druid';
import { UnitStat, UnitStatPresets } from '@sim/proto/stats';

import P5Gear from './gear_sets/p5.gear.json';
import PreraidGear from './gear_sets/preraid.gear.json';
import QELiveEpJson from './presets/ep/qe_live.ep.json';
import DefaultTalentsJson from './presets/talents/default.talents.json';

export const PRERAID_PRESET = PresetUtils.makePresetGear('Pre-raid', PreraidGear);
export const P5_PRESET = PresetUtils.makePresetGear('P5 BiS', P5Gear);

// Stat weights from QE Live's MoP Classic model, spell power = 1:
// https://github.com/Voulk/QuestionablyEpic/blob/dev/src/General/Modules/Player/ClassDefaults/Classic/Druid/RestoDruidClassic.js
// QE Live reforges to the 5-tick Rejuvenation breakpoint before applying its weights (haste 0.7).
// Haste sits just above mastery here so the reforge optimizer reaches that breakpoint too; past the
// threshold it falls back to QE's 0.7 (see the haste threshold in spec.ts).
export const DEFAULT_EP_PRESET = PresetUtils.makePresetEpWeightsFromJSON(QELiveEpJson);

// Default talents. Uses the wowhead calculator format, make the talents on
// https://wowhead.com/mop-classic/talent-calc and copy the numbers in the url.
export const DefaultTalents = PresetUtils.makePresetTalentsFromJSON(DefaultTalentsJson, { major: DruidMajorGlyph });

export const DefaultOptions = RestorationDruidOptions.create({
	classOptions: {
		innervateTarget: UnitReference.create(),
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

// HoT tick breakpoints as total spell haste percent (raid buff included):
// (ticks - 0.5) / baseTicks - 1. Rejuvenation 12s/3s, Wild Growth 7s/1s, Regrowth 6s/2s (durations
// and periods from DB2 5.5.0). The Regrowth breakpoint only matters without Glyph of Regrowth,
// which removes its HoT; the default glyphs include it.
export const QE_HASTE_EP_PAST_BREAKPOINT = 0.7;

export const RESTORATION_BREAKPOINTS: UnitStatPresets[] = [
	{
		unitStat: UnitStat.fromPseudoStat(PseudoStat.PseudoStatSpellHastePercent),
		presets: new Map([
			['8-tick - WG', 7.14286],
			['5-tick - Rejuv', 12.5],
			['4-tick - Regrowth', 16.66667],
			['9-tick - WG', 21.42858],
			['10-tick - WG', 35.71429],
			['6-tick - Rejuv', 37.5],
			['11-tick - WG', 50],
			['7-tick - Rejuv', 62.5],
		]),
	},
];
