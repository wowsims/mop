import * as PresetUtils from '../../core/preset_utils';
import { ConsumesSpec, Glyphs, Profession, PseudoStat, Stat } from '../../core/proto/common';
import { MonkMajorGlyph, MonkMinorGlyph, MonkOptions } from '../../core/proto/monk';
import { SavedTalents } from '../../core/proto/ui';
import { Stats } from '../../core/proto_utils/stats';
import DefaultApl from './apls/default.apl.json';
import DefaultP1BisGear from './gear_sets/p1_bis.gear.json';
import DefaultP2BisGear from './gear_sets/p2_bis.gear.json';
import DefaultP3BisGear from './gear_sets/p3_bis.gear.json';
import DefaultP1PreHofGear from './gear_sets/p1_pre_hof.gear.json';
import DefaultP1PreToesGear from './gear_sets/p1_pre_toes.gear.json';
import DefaultP1PrebisGear from './gear_sets/p1_prebis.gear.json';

export const P1_PREBIS_GEAR_PRESET = PresetUtils.makePresetGear('Pre-BIS', DefaultP1PrebisGear);
export const P1_PREHOF_GEAR_PRESET = PresetUtils.makePresetGear('Pre-HOF', DefaultP1PreHofGear);
export const P1_PRETOES_GEAR_PRESET = PresetUtils.makePresetGear('Pre-TOES', DefaultP1PreToesGear);
export const P1_BIS_GEAR_PRESET = PresetUtils.makePresetGear('P1 - BIS', DefaultP1BisGear);
export const P2_BIS_GEAR_PRESET = PresetUtils.makePresetGear('P2 - BIS', DefaultP2BisGear);
export const P3_BIS_GEAR_PRESET = PresetUtils.makePresetGear('P3 - BIS', DefaultP3BisGear);

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
			[Stat.StatHitRating]: 1.66,
			[Stat.StatCritRating]: 0.69,
			[Stat.StatHasteRating]: 0.83,
			[Stat.StatExpertiseRating]: 1.39,
			[Stat.StatMasteryRating]: 0.32,
			[Stat.StatAttackPower]: 0.35,
		},
		{
			[PseudoStat.PseudoStatMainHandDps]: 2.35,
			[PseudoStat.PseudoStatOffHandDps]: 1.18,
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
