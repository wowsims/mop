import * as PresetUtils from '../../core/preset_utils';
import { ConsumesSpec, Glyphs, Profession, PseudoStat, Spec, Stat } from '../../core/proto/common';
import { MonkMajorGlyph, MonkMinorGlyph, MonkOptions } from '../../core/proto/monk';
import { SavedTalents } from '../../core/proto/ui';
import { Stats } from '../../core/proto_utils/stats';
import DefaultApl from './apls/default.apl.json';
import DefaultP2BisGear from './gear_sets/p2_bis.gear.json';
import DefaultP3BisGear from './gear_sets/p3_bis.gear.json';
import DefaultP5BisGear from './gear_sets/p5_bis.gear.json';
import DefaultPrebisGear from './gear_sets/prebis.gear.json';
import { Player } from '../../core/player';

export const PREBIS_GEAR_PRESET = PresetUtils.makePresetGear('Pre-BIS', DefaultPrebisGear);
export const P2_BIS_GEAR_PRESET = PresetUtils.makePresetGear('P2 - BIS', DefaultP2BisGear, {
	onLoad: (player: Player<Spec.SpecFuryWarrior>) => {
		PresetUtils.makeSpecChangeWarningToast(
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
export const P3_BIS_GEAR_PRESET = PresetUtils.makePresetGear('P3 - BIS', DefaultP3BisGear, {
	onLoad: (player: Player<Spec.SpecFuryWarrior>) => {
		PresetUtils.makeSpecChangeWarningToast(
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
export const P5_BIS_GEAR_PRESET = PresetUtils.makePresetGear('P5 - BIS (WIP)', DefaultP5BisGear, {
	onLoad: (player: Player<Spec.SpecFuryWarrior>) => {
		PresetUtils.makeSpecChangeWarningToast(
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

export const RORO_BIS_EP_PRESET = PresetUtils.makePresetEpWeights(
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
	profession2: Profession.Tailoring,
	distanceFromTarget: 5,
	iterationCount: 25000,
};

export const P2_BUILD_PRESET = PresetUtils.makePresetBuild('P2 - BIS', {
	gear: P2_BIS_GEAR_PRESET,
	settings: {
		name: 'P2 - BIS',
		playerOptions: OtherDefaults,
	},
});
export const P3_BUILD_PRESET = PresetUtils.makePresetBuild('P3 - BIS', {
	gear: P3_BIS_GEAR_PRESET,
	settings: {
		name: 'P3 - BIS',
		playerOptions: {
			...OtherDefaults,
			profession1: Profession.Engineering,
			profession2: Profession.Blacksmithing,
		},
	},
});
