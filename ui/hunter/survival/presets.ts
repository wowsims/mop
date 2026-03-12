import * as PresetUtils from '../../core/preset_utils';
import { APLRotation_Type as APLRotationType } from '../../core/proto/apl.js';
import { ConsumesSpec, Glyphs, Profession, PseudoStat, Race, Spec, Stat } from '../../core/proto/common';
import { HunterMajorGlyph as MajorGlyph, HunterOptions_PetType as PetType, SurvivalHunter_Options as HunterOptions } from '../../core/proto/hunter';
import { SavedTalents } from '../../core/proto/ui';
import { Stats } from '../../core/proto_utils/stats';
import P2Build from './builds/p2.build.json';
import P3Build from './builds/p3.build.json';
import P2Gear from './gear_sets/p2.gear.json';
import P3Gear from './gear_sets/p3.gear.json';
import P5Gear from './gear_sets/p5.gear.json';
import PreRaidGear from './gear_sets/preraid.gear.json';
import AoeApl from './apls/aoe.apl.json';
import SvApl from './apls/sv.apl.json';

export const PRERAID_PRESET_GEAR = PresetUtils.makePresetGear('Pre-raid', PreRaidGear);
export const P2_PRESET_GEAR = PresetUtils.makePresetGear('P2', P2Gear);
export const P3_PRESET_GEAR = PresetUtils.makePresetGear('P3', P3Gear);
export const P5_PRESET_GEAR = PresetUtils.makePresetGear('P5 (WiP)', P5Gear);
export const ROTATION_PRESET_SV = PresetUtils.makePresetAPLRotation('Single Target', SvApl);
export const ROTATION_PRESET_AOE = PresetUtils.makePresetAPLRotation('AOE', AoeApl);
export const DefaultTalents = {
	name: 'Default',
	data: SavedTalents.create({
		talentsString: '312213',
		glyphs: Glyphs.create({
			major1: MajorGlyph.GlyphOfAnimalBond,
			major2: MajorGlyph.GlyphOfDeterrence,
			major3: MajorGlyph.GlyphOfLiberation,
		}),
	}),
};

export const P2_EP_PRESET = PresetUtils.makePresetEpWeights(
	'P2',
	Stats.fromMap(
		{
			[Stat.StatAgility]: 1,
			[Stat.StatRangedAttackPower]: 0.38,
			[Stat.StatHitRating]: 0.33,
			[Stat.StatCritRating]: 0.32,
			[Stat.StatHasteRating]: 0.27,
			[Stat.StatMasteryRating]: 0.21,
			[Stat.StatExpertiseRating]: 0.33,
		},
		{
			[PseudoStat.PseudoStatRangedDps]: 0.5,
		},
	),
);
export const P3_EP_PRESET = PresetUtils.makePresetEpWeights(
	'P3',
	Stats.fromMap(
		{
			[Stat.StatAgility]: 1,
			[Stat.StatRangedAttackPower]: 0.36,
			[Stat.StatHitRating]: 0.37,
			[Stat.StatCritRating]: 0.36,
			[Stat.StatHasteRating]: 0.32,
			[Stat.StatMasteryRating]: 0.26,
			[Stat.StatExpertiseRating]: 0.37,
		},
		{
			[PseudoStat.PseudoStatRangedDps]: 0.67,
		},
	),
);

export const P2_PRESET = PresetUtils.makePresetBuildFromJSON('P2', Spec.SpecSurvivalHunter, P2Build, {
	epWeights: P2_EP_PRESET,
	rotationType: APLRotationType.TypeAuto,
});
export const P3_PRESET = PresetUtils.makePresetBuildFromJSON('P3', Spec.SpecSurvivalHunter, P3Build, {
	epWeights: P3_EP_PRESET,
	rotationType: APLRotationType.TypeAuto,
});

export const SVDefaultOptions = HunterOptions.create({
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
	profession2: Profession.Tailoring,
	race: Race.RaceOrc,
};
