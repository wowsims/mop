import * as PresetUtils from '../../core/preset_utils';
import { APLRotation_Type as APLRotationType } from '../../core/proto/apl.js';
import { ConsumesSpec, Glyphs, Profession, PseudoStat, Race, Spec, Stat } from '../../core/proto/common';
import { HunterMajorGlyph as MajorGlyph, HunterOptions_PetType as PetType, SurvivalHunter_Options as HunterOptions } from '../../core/proto/hunter';
import { SavedTalents } from '../../core/proto/ui';
import { Stats } from '../../core/proto_utils/stats';
import P5Build from './builds/p5.build.json';
import P5Gear from './gear_sets/p5.gear.json';
import PreRaidGear from './gear_sets/preraid.gear.json';
import AoeApl from './apls/aoe.apl.json';
import Apl from './apls/mm.apl.json';

export const PRERAID_PRESET_GEAR = PresetUtils.makePresetGear('Pre-raid', PreRaidGear);
export const P5_PRESET_GEAR = PresetUtils.makePresetGear('P5', P5Gear);
export const ROTATION_PRESET_MM = PresetUtils.makePresetAPLRotation('Single Target', Apl);
export const ROTATION_PRESET_AOE = PresetUtils.makePresetAPLRotation('AOE', AoeApl);
export const DefaultTalents = {
	name: 'Default',
	data: SavedTalents.create({
		talentsString: '312213',
		glyphs: Glyphs.create({
			major1: MajorGlyph.GlyphOfAnimalBond,
			major2: MajorGlyph.GlyphOfDeterrence,
			major3: MajorGlyph.GlyphOfAimedShot,
		}),
	}),
};

export const P5_EP_PRESET = PresetUtils.makePresetEpWeights(
	'P5',
	Stats.fromMap(
		{
			[Stat.StatAgility]: 1,
			[Stat.StatRangedAttackPower]: 0.33,
			[Stat.StatHitRating]: 0.47,
			[Stat.StatCritRating]: 0.35,
			[Stat.StatHasteRating]: 0.46,
			[Stat.StatMasteryRating]: 0.2,
			[Stat.StatExpertiseRating]: 0.47,
		},
		{
			[PseudoStat.PseudoStatRangedDps]: 1.72,
		},
	),
);

export const P5_PRESET = PresetUtils.makePresetBuildFromJSON('P5', Spec.SpecMarksmanshipHunter, P5Build, {
	epWeights: P5_EP_PRESET,
	rotationType: APLRotationType.TypeAuto,
});

export const MMDefaultOptions = HunterOptions.create({
	classOptions: {
		useHuntersMark: true,
		petType: PetType.Tallstrider,
		petUptime: 1,
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
