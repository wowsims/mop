import * as PresetUtils from '../../core/preset_utils';
import { APLRotation_Type as APLRotationType } from '../../core/proto/apl.js';
import { ConsumesSpec, Glyphs, Profession, PseudoStat, Race, Spec, Stat } from '../../core/proto/common';
import { HunterMajorGlyph as MajorGlyph, HunterOptions_PetType as PetType, SurvivalHunter_Options as HunterOptions } from '../../core/proto/hunter';
import { SavedTalents } from '../../core/proto/ui';
import { Stats } from '../../core/proto_utils/stats';
import P4Build from './builds/p4.build.json';
import P4Gear from './gear_sets/p4.gear.json';
import P5Gear from './gear_sets/p5.gear.json';
import PreRaidGear from './gear_sets/preraid.gear.json';
import AoeApl from './apls/aoe.apl.json';
import SvApl from './apls/sv.apl.json';

export const PRERAID_PRESET_GEAR = PresetUtils.makePresetGear('Pre-raid', PreRaidGear);
export const P4_PRESET_GEAR = PresetUtils.makePresetGear('P4', P4Gear);
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

export const P4_FERVOR_EP_PRESET = PresetUtils.makePresetEpWeights(
	'P4 (Fervor)',
	Stats.fromMap(
		{
			[Stat.StatAgility]: 1,
			[Stat.StatHitRating]: 0.37,
			[Stat.StatExpertiseRating]: 0.37,
			[Stat.StatRangedAttackPower]: 0.36,
			[Stat.StatCritRating]: 0.36,
			[Stat.StatHasteRating]: 0.32,
			[Stat.StatMasteryRating]: 0.26,
		},
		{
			[PseudoStat.PseudoStatRangedDps]: 0.67,
		},
	),
);

export const P4_DB_EP_PRESET = PresetUtils.makePresetEpWeights(
	'P4 (Dire Beast)',
	Stats.fromMap(
		{
			[Stat.StatAgility]: 1,
			[Stat.StatHitRating]: 0.37,
			[Stat.StatExpertiseRating]: 0.37,
			[Stat.StatHasteRating]: 0.37,
			[Stat.StatRangedAttackPower]: 0.36,
			[Stat.StatCritRating]: 0.36,
			[Stat.StatMasteryRating]: 0.26,
		},
		{
			[PseudoStat.PseudoStatRangedDps]: 0.67,
		},
	),
);

export const P4_PRESET = PresetUtils.makePresetBuildFromJSON('P4', Spec.SpecSurvivalHunter, P4Build, {
	epWeights: P4_FERVOR_EP_PRESET,
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
