import * as PresetUtils from '@app/preset_utils';
import { APLRotation_Type as APLRotationType } from '@generated/proto/apl';
import { ConsumesSpec, Profession, Race, Spec } from '@generated/proto/common';
import { BeastMasteryHunter_Options as BeastMasteryOptions, HunterMajorGlyph as MajorGlyph, HunterOptions_PetType as PetType } from '@generated/proto/hunter';

import BmApl from './apls/bm.apl.json';
import P5Build from './builds/p5.build.json';
import P5Gear from './gear_sets/p5.gear.json';
import PreRaidGear from './gear_sets/preraid.gear.json';
import P5EpJson from './presets/ep/p5.ep.json';
import DefaultTalentsJson from './presets/talents/default.talents.json';

export const PRERAID_PRESET_GEAR = PresetUtils.makePresetGear('Pre-raid', PreRaidGear);
export const P5_PRESET_GEAR = PresetUtils.makePresetGear('P5', P5Gear);
export const ROTATION_PRESET_BM = PresetUtils.makePresetAPLRotation('BM', BmApl);
export const DefaultTalents = PresetUtils.makePresetTalentsFromJSON(DefaultTalentsJson, { major: MajorGlyph });

export const P5_EP_PRESET = PresetUtils.makePresetEpWeightsFromJSON(P5EpJson);

export const P5_PRESET = PresetUtils.makePresetBuildFromJSON('P5', Spec.SpecBeastMasteryHunter, P5Build, {
	epWeights: P5_EP_PRESET,
	rotationType: APLRotationType.TypeAuto,
});

export const BMDefaultOptions = BeastMasteryOptions.create({
	classOptions: {
		petUptime: 1,
		useHuntersMark: true,
		petType: PetType.Tallstrider,
		glaiveTossSuccess: 0.8,
	},
});

export const DefaultConsumables = ConsumesSpec.create({
	flaskId: 76084, // Flask of the Winds
	foodId: 74648, // Seafood Magnifique Feast
	potId: 76089, // Potion of the Tol'vir
	prepotId: 76089, // Potion of the Tol'vir
});

export const OtherDefaults = {
	distanceFromTarget: 24,
	iterationCount: 25000,
	profession1: Profession.Engineering,
	profession2: Profession.Herbalism,
	race: Race.RaceOrc,
};
