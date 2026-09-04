import * as PresetUtils from '@app/preset_utils';
import { Player } from '@domain/player';
import { makeSpecChangeWarningToast } from '@features/settings/view/spec_change_warning_toast';
import { APLRotation_Type } from '@generated/proto/apl';
import { ConsumesSpec, Profession, Race, Spec } from '@generated/proto/common';
import { DeathKnightMajorGlyph, DeathKnightMinorGlyph, UnholyDeathKnight_Options } from '@generated/proto/death_knight';

import DefaultApl from './apls/default.apl.json';
import FesterblightApl from './apls/festerblight.apl.json';
import P5Build from './builds/p5.build.json';
import PrebisBuild from './builds/prebis.build.json';
import P5Gear from './gear_sets/p5.gear.json';
import PrebisGear from './gear_sets/prebis.gear.json';
import DefaultEpJson from './presets/ep/default.ep.json';
import DefaultTalentsJson from './presets/talents/default.talents.json';
import FesterblightTalentsJson from './presets/talents/festerblight.talents.json';

// Preset options for this spec.
// Eventually we will import these values for the raid sim too, so its good to
// keep them in a separate file.
export const PREBIS_GEAR_PRESET = PresetUtils.makePresetGear('Prebis', PrebisGear);
export const P5_BIS_GEAR_PRESET = PresetUtils.makePresetGear('P5', P5Gear);

export const DEFAULT_ROTATION_PRESET = PresetUtils.makePresetAPLRotation('Default', DefaultApl);
export const FESTERBLIGHT_ROTATION_PRESET = PresetUtils.makePresetAPLRotation('Festerblight', FesterblightApl, {
	onLoad: (player: Player<Spec.SpecUnholyDeathKnight>) =>
		makeSpecChangeWarningToast(
			[
				{
					condition: (player: Player<Spec.SpecUnholyDeathKnight>) => player.sim.encounter.getTargets().length > 1,
					message: 'Festerblight is a single-target rotation. Use the Default rotation for multiple targets.',
				},
			],
			player,
		),
});

// Preset options for EP weights
export const DEFAULT_UNHOLY_EP_PRESET = PresetUtils.makePresetEpWeightsFromJSON(DefaultEpJson);

// Default talents. Uses the wowhead calculator format, make the talents on
// https://wowhead.com/mop-classic/talent-calc and copy the numbers in the url.

export const DefaultTalents = PresetUtils.makePresetTalentsFromJSON(DefaultTalentsJson, {
	major: DeathKnightMajorGlyph,
	minor: DeathKnightMinorGlyph,
});

export const FesterblightTalents = PresetUtils.makePresetTalentsFromJSON(FesterblightTalentsJson, {
	major: DeathKnightMajorGlyph,
	minor: DeathKnightMinorGlyph,
});

export const PREBIS_PRESET = PresetUtils.makePresetBuildFromJSON('Prebis', Spec.SpecUnholyDeathKnight, PrebisBuild, {
	epWeights: DEFAULT_UNHOLY_EP_PRESET,
	rotationType: APLRotation_Type.TypeAuto,
});
export const P5_PRESET = PresetUtils.makePresetBuildFromJSON('P5', Spec.SpecUnholyDeathKnight, P5Build, {
	epWeights: DEFAULT_UNHOLY_EP_PRESET,
	rotationType: APLRotation_Type.TypeAuto,
});

export const DefaultOptions = UnholyDeathKnight_Options.create({
	classOptions: {},
	amsNumTicks: 1,
});

export const OtherDefaults = {
	profession1: Profession.Engineering,
	profession2: Profession.Herbalism,
	distanceFromTarget: 5,
	race: Race.RaceTroll,
	iterationCount: 25000,
};

export const DefaultConsumables = ConsumesSpec.create({
	flaskId: 76088, // Flask of Winter's Bite
	foodId: 74646, // Black Pepper Ribs and Shrimp
	potId: 76095, // Potion of Mogu Power
	prepotId: 76095, // Potion of Mogu Power
});
