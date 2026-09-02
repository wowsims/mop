import * as PresetUtils from '@app/preset_utils';
import { ConsumesSpec, Profession, Spec } from '@core/proto/common';
import { MonkMajorGlyph, MonkMinorGlyph, MonkOptions } from '@core/proto/monk';
import { Player } from '@domain/player';
import { makeSpecChangeWarningToast } from '@features/settings/view/spec_change_warning_toast';

import DefaultApl from './apls/default.apl.json';
import DefaultP2BisGear from './gear_sets/p2_bis.gear.json';
import DefaultP4BisGear from './gear_sets/p4_bis.gear.json';
import DefaultP5BisGear from './gear_sets/p5_bis.gear.json';
import DefaultPrebisGear from './gear_sets/prebis.gear.json';
import P1BisEpJson from './presets/ep/p1_bis.ep.json';
import RoroP34EpJson from './presets/ep/roro_p3_4.ep.json';
import RoroP5EpJson from './presets/ep/roro_p5.ep.json';
import DefaultTalentsJson from './presets/talents/default.talents.json';

export const PREBIS_GEAR_PRESET = PresetUtils.makePresetGear('Pre-BIS', DefaultPrebisGear);
export const P2_BIS_GEAR_PRESET = PresetUtils.makePresetGear('P2 - BIS', DefaultP2BisGear, {
	onLoad: (player: Player<Spec.SpecFuryWarrior>) => {
		makeSpecChangeWarningToast(
			[
				{
					condition: (player: Player<Spec.SpecFuryWarrior>) => player.getProfessions().includes(Profession.Tailoring) === false,
					message: 'This preset assumes tailoring. Please reforge/regem for optimal results.',
				},
			],
			player,
		);
	},
});

export const P3_4_BIS_GEAR_PRESET = PresetUtils.makePresetGear('P3 & P4 - BIS', DefaultP4BisGear, {
	onLoad: (player: Player<Spec.SpecFuryWarrior>) => {
		makeSpecChangeWarningToast(
			[
				{
					condition: (player: Player<Spec.SpecFuryWarrior>) => player.getProfessions().includes(Profession.Blacksmithing) === false,
					message: 'This preset assumes blacksmithing for the Rune of Re-Origination proc. Please reforge/regem for optimal results.',
				},
			],
			player,
		);
	},
});
export const P5_BIS_GEAR_PRESET = PresetUtils.makePresetGear('P5 - BIS', DefaultP5BisGear, {
	onLoad: (player: Player<Spec.SpecFuryWarrior>) => {
		makeSpecChangeWarningToast(
			[
				{
					condition: (player: Player<Spec.SpecFuryWarrior>) => player.getProfessions().includes(Profession.Blacksmithing) === false,
					message: 'This preset assumes blacksmithing for the Rune of Re-Origination proc. Please reforge/regem for optimal results.',
				},
			],
			player,
		);
	},
});

export const ROTATION_PRESET = PresetUtils.makePresetAPLRotation('Default', DefaultApl);

// Preset options for EP weights
export const P1_BIS_EP_PRESET = PresetUtils.makePresetEpWeightsFromJSON(P1BisEpJson);

export const RORO_P3_4_EP_PRESET = PresetUtils.makePresetEpWeightsFromJSON(RoroP34EpJson);

export const RORO_P5_EP_PRESET = PresetUtils.makePresetEpWeightsFromJSON(RoroP5EpJson);

// Default talents. Uses the wowhead calculator format, make the talents on
// https://wowhead.com/mop/talent-calc and copy the numbers in the url.

export const DefaultTalents = PresetUtils.makePresetTalentsFromJSON(DefaultTalentsJson, { major: MonkMajorGlyph, minor: MonkMinorGlyph });

export const DefaultOptions = MonkOptions.create({
	classOptions: {},
});

export const DefaultConsumables = ConsumesSpec.create({
	flaskId: 76084, // Flask of Spring Blossoms
	foodId: 74648, // Sea Mist Rice Noodles
	potId: 76089, // Virmen's Bite
	prepotId: 76089, // Virmen's Bite
});

export const OtherDefaults = {
	profession1: Profession.Engineering,
	profession2: Profession.Blacksmithing,
	distanceFromTarget: 5,
	iterationCount: 25000,
};

export const P2_BUILD_PRESET = PresetUtils.makePresetBuild('P2 - BIS', {
	gear: P2_BIS_GEAR_PRESET,
	settings: {
		name: 'P2 - BIS',
		playerOptions: {
			...OtherDefaults,
			profession1: Profession.Engineering,
			profession2: Profession.Tailoring,
		},
	},
});
export const P3_4_BUILD_PRESET = PresetUtils.makePresetBuild('P3 & P4 - BIS', {
	gear: P3_4_BIS_GEAR_PRESET,
	settings: {
		name: 'P3 & P4 - BIS',
		playerOptions: OtherDefaults,
	},
});

export const P5_BUILD_PRESET = PresetUtils.makePresetBuild('P5 - BIS', {
	gear: P5_BIS_GEAR_PRESET,
	settings: {
		name: 'P5 - BIS',
		playerOptions: OtherDefaults,
	},
});
