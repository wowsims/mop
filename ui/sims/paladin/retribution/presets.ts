import * as PresetUtils from '@app/preset_utils';
import { APLRotation_Type as APLRotationType } from '@core/proto/apl';
import { ConsumesSpec, Profession, Race, Spec } from '@core/proto/common';
import { PaladinMajorGlyph, PaladinSeal, RetributionPaladin_Options as RetributionPaladinOptions } from '@core/proto/paladin';

import DefaultApl from './apls/default.apl.json';
import P5RetBuild from './builds/p5.build.json';
import P5_Gear from './gear_sets/p5.gear.json';
import Preraid_Gear from './gear_sets/preraid.gear.json';
import P5EpJson from './presets/ep/p5.ep.json';
import PreraidEpJson from './presets/ep/preraid.ep.json';
import DefaultTalentsJson from './presets/talents/default.talents.json';

export const P5_GEAR_PRESET = PresetUtils.makePresetGear('P5', P5_Gear);
export const PRERAID_GEAR_PRESET = PresetUtils.makePresetGear('Pre-raid', Preraid_Gear);

export const APL_PRESET = PresetUtils.makePresetAPLRotation('Default', DefaultApl);

export const P5_EP_PRESET = PresetUtils.makePresetEpWeightsFromJSON(P5EpJson);

export const PRERAID_EP_PRESET = PresetUtils.makePresetEpWeightsFromJSON(PreraidEpJson);

export const DefaultTalents = PresetUtils.makePresetTalentsFromJSON(DefaultTalentsJson, { major: PaladinMajorGlyph });

export const P5_BUILD_PRESET = PresetUtils.makePresetBuildFromJSON('P5', Spec.SpecRetributionPaladin, P5RetBuild, {
	epWeights: P5_EP_PRESET,
	rotationType: APLRotationType.TypeAuto,
});

export const DefaultOptions = RetributionPaladinOptions.create({
	classOptions: {
		seal: PaladinSeal.Truth,
	},
});

export const DefaultConsumables = ConsumesSpec.create({
	flaskId: 76088, // Flask of Winter's Bite
	foodId: 74646, // Black Pepper Ribs and Shrimp
	potId: 76095, // Potion of Mogu Power
	prepotId: 76095, // Potion of Mogu Power
});

export const OtherDefaults = {
	profession1: Profession.Engineering,
	profession2: Profession.Herbalism,
	distanceFromTarget: 5,
	iterationCount: 25000,
	race: Race.RaceBloodElf,
};
