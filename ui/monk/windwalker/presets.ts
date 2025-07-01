import * as PresetUtils from '../../core/preset_utils';
import { ConsumesSpec, Glyphs, Profession, PseudoStat, Stat } from '../../core/proto/common';
import { MonkMajorGlyph, MonkMinorGlyph, MonkOptions } from '../../core/proto/monk';
import { SavedTalents } from '../../core/proto/ui';
import { Stats } from '../../core/proto_utils/stats';
import DefaultApl from './apls/default.apl.json';
import DefaultP1Bis2HGear from './gear_sets/p1_bis_2h.gear.json';
import DefaultP1BisDWGear from './gear_sets/p1_bis_dw.gear.json';
import DefaultP1Prebis2HGear from './gear_sets/p1_prebis_2h.gear.json';
import DefaultP1PrebisDWGear from './gear_sets/p1_prebis_dw.gear.json';

export const P1_PREBIS_2H_GEAR_PRESET = PresetUtils.makePresetGear('Pre-BIS - 2H', DefaultP1Prebis2HGear);
export const P1_PREBIS_DW_GEAR_PRESET = PresetUtils.makePresetGear('Pre-BIS - DW', DefaultP1PrebisDWGear);

export const P1_BIS_2H_GEAR_PRESET = PresetUtils.makePresetGear('BIS - 2H', DefaultP1Bis2HGear);
export const P1_BIS_DW_GEAR_PRESET = PresetUtils.makePresetGear('BIS - DW', DefaultP1BisDWGear);

export const ROTATION_PRESET = PresetUtils.makePresetAPLRotation('Default', DefaultApl);

// Preset options for EP weights
export const P1_PREBIS_2H_EP_PRESET = PresetUtils.makePresetEpWeights(
	'Default - 2H',
	Stats.fromMap(
		{
			[Stat.StatAgility]: 1.0,
			[Stat.StatHitRating]: 1.38,
			[Stat.StatCritRating]: 0.46,
			[Stat.StatHasteRating]: 0.54,
			[Stat.StatExpertiseRating]: 1.22	,
			[Stat.StatMasteryRating]: 0.38,
			[Stat.StatAttackPower]: 0.36,
		},
		{
			[PseudoStat.PseudoStatMainHandDps]: 3.04,
			[PseudoStat.PseudoStatOffHandDps]: 0,
			[PseudoStat.PseudoStatPhysicalHitPercent]: 469.62,
		},
	),
);

// Preset options for EP weights
export const P1_PREBIS_DW_EP_PRESET = PresetUtils.makePresetEpWeights(
	'Default - DW',
	Stats.fromMap(
		{
			[Stat.StatAgility]: 1.0,
			[Stat.StatHitRating]: 1.41,
			[Stat.StatCritRating]: 0.46,
			[Stat.StatHasteRating]: 0.57,
			[Stat.StatExpertiseRating]: 0.99	,
			[Stat.StatMasteryRating]: 0.39,
			[Stat.StatAttackPower]: 0.36,
		},
		{
			[PseudoStat.PseudoStatMainHandDps]: 2.62,
			[PseudoStat.PseudoStatOffHandDps]: 1.31,
			[PseudoStat.PseudoStatPhysicalHitPercent]: 478.07,
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
