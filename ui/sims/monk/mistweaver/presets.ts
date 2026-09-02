import * as PresetUtils from '@app/preset_utils';
import { UnitStat, UnitStatPresets } from '@domain/proto_utils/stats';
import { ConsumesSpec, Profession, PseudoStat } from '@generated/proto/common';
import { MistweaverMonk_Options as MistweaverMonkOptions, MonkMajorGlyph, MonkMinorGlyph } from '@generated/proto/monk';

import DefaultGear from './gear_sets/default.gear.json';
import DefaultEpJson from './presets/ep/default.ep.json';
import DefaultTalentsJson from './presets/talents/default.talents.json';

// Preset options for this spec.
// Eventually we will import these values for the raid sim too, so its good to
// keep them in a separate file.

export const PREBIS_GEAR_PRESET = PresetUtils.makePresetGear('Default', DefaultGear);

// Preset options for EP weights
export const DEFAULT_EP_PRESET = PresetUtils.makePresetEpWeightsFromJSON(DefaultEpJson);

// Default talents. Uses the wowhead calculator format, make the talents on
// https://wowhead.com/mop/talent-calc and copy the numbers in the url.

export const DefaultTalents = PresetUtils.makePresetTalentsFromJSON(DefaultTalentsJson, { major: MonkMajorGlyph, minor: MonkMinorGlyph });

export const DefaultOptions = MistweaverMonkOptions.create({
	classOptions: {},
});

export const DefaultConsumables = ConsumesSpec.create({
	flaskId: 76093, // Flask of the Winds
	foodId: 62290, // Seafood Magnifique Feast
	potId: 76093, // Potion of the Jade Serpent
	prepotId: 76093, // Potion of the Jade Serpent
});

export const OtherDefaults = {
	profession1: Profession.Engineering,
	profession2: Profession.Blacksmithing,
	distanceFromTarget: 5,
	iterationCount: 25000,
};

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
