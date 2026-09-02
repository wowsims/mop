import * as PresetUtils from '@app/preset_utils';
import { Player } from '@domain/player';
import { Stats } from '@domain/proto_utils/stats';
import { makeSpecChangeWarningToast } from '@features/settings/view/spec_change_warning_toast';

import { ConsumesSpec, Glyphs, Profession, PseudoStat, Spec, Stat } from '../../core/proto/common';
import { MonkMajorGlyph, MonkMinorGlyph, MonkOptions } from '../../core/proto/monk';
import { SavedTalents } from '../../core/proto/ui';
import DefaultApl from './apls/default.apl.json';
import DefaultP2BisGear from './gear_sets/p2_bis.gear.json';
import DefaultP4BisGear from './gear_sets/p4_bis.gear.json';
import DefaultP5BisGear from './gear_sets/p5_bis.gear.json';
import DefaultPrebisGear from './gear_sets/prebis.gear.json';

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
export const P1_BIS_EP_PRESET = PresetUtils.makePresetEpWeights(
	'Default',
	Stats.fromMap(
		{
			[Stat.StatAgility]: 1.0,
			[Stat.StatHitRating]: 1.41,
			[Stat.StatCritRating]: 0.44,
			[Stat.StatHasteRating]: 0.49,
			[Stat.StatExpertiseRating]: 0.99,
			[Stat.StatMasteryRating]: 0.39,
			[Stat.StatAttackPower]: 0.36,
		},
		{
			[PseudoStat.PseudoStatMainHandDps]: 2.62,
			[PseudoStat.PseudoStatOffHandDps]: 1.31,
		},
	),
);

export const RORO_P3_4_EP_PRESET = PresetUtils.makePresetEpWeights(
	'RoRo',
	Stats.fromMap(
		{
			[Stat.StatAgility]: 1.0,
			[Stat.StatHitRating]: 1.79,
			[Stat.StatCritRating]: 0.74,
			[Stat.StatHasteRating]: 0.89,
			[Stat.StatExpertiseRating]: 1.49,
			[Stat.StatMasteryRating]: 0.34,
			[Stat.StatAttackPower]: 0.35,
		},
		{
			[PseudoStat.PseudoStatMainHandDps]: 2.33,
			[PseudoStat.PseudoStatOffHandDps]: 1.17,
		},
	),
);

export const RORO_P5_EP_PRESET = PresetUtils.makePresetEpWeights(
	'RoRo >= 560',
	Stats.fromMap(
		{
			[Stat.StatAgility]: 1.0,
			[Stat.StatHitRating]: 2.46,
			[Stat.StatCritRating]: 0.83,
			[Stat.StatHasteRating]: 1.05,
			[Stat.StatExpertiseRating]: 2.11,
			[Stat.StatMasteryRating]: 0.39,
			[Stat.StatAttackPower]: 0.34,
		},
		{
			[PseudoStat.PseudoStatMainHandDps]: 2.19,
			[PseudoStat.PseudoStatOffHandDps]: 1.1,
		},
	),
);

// Default talents. Uses the wowhead calculator format, make the talents on
// https://wowhead.com/mop/talent-calc and copy the numbers in the url.

export const DefaultTalents = {
	name: 'Default',
	data: SavedTalents.create({
		talentsString: '213322',
		glyphs: Glyphs.create({
			major1: MonkMajorGlyph.GlyphOfSpinningCraneKick,
			major2: MonkMajorGlyph.GlyphOfTouchOfKarma,
			minor1: MonkMinorGlyph.GlyphOfBlackoutKick,
		}),
	}),
};

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
