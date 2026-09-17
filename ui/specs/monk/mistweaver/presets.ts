import * as PresetUtils from '@app/preset_utils';
import { ConsumesSpec, Profession, PseudoStat } from '@generated/proto/common';
import { MistweaverMonk_Options as MistweaverMonkOptions, MonkMajorGlyph } from '@generated/proto/monk';
import { UnitStat, UnitStatPresets } from '@sim/proto/stats';

import P5Gear from './gear_sets/p5.gear.json';
import PreraidGear from './gear_sets/preraid.gear.json';
import QELiveEpJson from './presets/ep/qe_live.ep.json';
import DefaultTalentsJson from './presets/talents/default.talents.json';

export const PRERAID_PRESET = PresetUtils.makePresetGear('Pre-raid', PreraidGear);
export const P5_PRESET = PresetUtils.makePresetGear('P5 BiS', P5Gear);

// Stat weights from QE Live's MoP Classic model, spell power = 1:
// https://github.com/Voulk/QuestionablyEpic/blob/dev/src/General/Modules/Player/ClassDefaults/Classic/Monk/MistweaverMonkClassic.js
// QE Live has no hit weight: its profile takes hit from Spirit alone. Hit rating only matters for the
// Eminence healing a fistweaver gets from landing attacks, so it sits below crit and below twice
// Spirit's own weight, which keeps a Spirit reforge ahead of a Hit reforge on the way to the 15% cap.
// QE weights haste at 0.3 and reforges to a Renewing Mist tick breakpoint separately. Haste sits
// just above crit here so the reforge optimizer reaches that breakpoint too; past the threshold it
// falls back to QE's 0.3 (see the haste threshold in spec.ts).
export const DEFAULT_EP_PRESET = PresetUtils.makePresetEpWeightsFromJSON(QELiveEpJson);

// Default talents. Uses the wowhead calculator format, make the talents on
// https://wowhead.com/mop-classic/talent-calc and copy the numbers in the url.
export const DefaultTalents = PresetUtils.makePresetTalentsFromJSON(DefaultTalentsJson, { major: MonkMajorGlyph });

export const DefaultOptions = MistweaverMonkOptions.create({
	classOptions: {},
});

export const DefaultConsumables = ConsumesSpec.create({
	flaskId: 76085, // Flask of the Warm Sun
	foodId: 74650, // Mogu Fish Stew
	potId: 76093, // Potion of the Jade Serpent
});

export const OtherDefaults = {
	profession1: Profession.Engineering,
	profession2: Profession.Leatherworking,
	distanceFromTarget: 5,
};

export const QE_HASTE_EP_PAST_BREAKPOINT = 0.3;

export const MISTWEAVER_BREAKPOINTS: UnitStatPresets[] = [
	{
		unitStat: UnitStat.fromPseudoStat(PseudoStat.PseudoStatSpellHastePercent),
		presets: new Map([
			['10-tick - ReM', 5.56876],
			['7-tick - EvM', 8.28372],
			['11-tick - ReM', 16.65209],
			['8-tick - EvM', 24.92194],
			['12-tick - ReM', 27.75472],
			['13-tick - ReM', 38.93714],
			['9-tick - EvM', 41.74346],
			['14-tick - ReM', 49.98126],
			['10-tick - EvM', 58.35315],
			['15-tick - ReM', 61.09546],
			['16-tick - ReM', 72.19115],
			['11-tick - EvM', 74.97816],
			['17-tick - ReM', 83.40213],
			['12-tick - EvM', 91.75459],
			['18-tick - ReM', 94.45797],
			['13-tick - EvM', 108.55062],
			['14-tick - EvM', 124.97193],
			['15-tick - EvM', 141.83803],
		]),
	},
];
