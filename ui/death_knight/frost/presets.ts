import * as PresetUtils from '../../core/preset_utils';
import { APLRotation_Type } from '../../core/proto/apl';
import { ConsumesSpec, Glyphs, Profession, PseudoStat, Race, Spec, Stat } from '../../core/proto/common';
import { DeathKnightMajorGlyph, DeathKnightMinorGlyph, FrostDeathKnight_Options } from '../../core/proto/death_knight';
import { SavedTalents } from '../../core/proto/ui';
import { Stats } from '../../core/proto_utils/stats';
import MasterFrostAPL from '../../death_knight/frost/apls/masterfrost.apl.json';
import ObliterateAPL from '../../death_knight/frost/apls/obliterate.apl.json';
import P22hObliterateBuild from '../../death_knight/frost/builds/p2.2h-obliterate.build.json';
import P2MasterfrostBuild from '../../death_knight/frost/builds/p2.masterfrost.build.json';
import P32hObliterateBuild from '../../death_knight/frost/builds/p3.2h-obliterate.build.json';
import P3MasterfrostBuild from '../../death_knight/frost/builds/p3.masterfrost.build.json';
import PrebisMasterfrostBuild from '../../death_knight/frost/builds/prebis.masterfrost.build.json';
import Prebis2hObliterateBuild from '../../death_knight/frost/builds/prebis.2h-obliterate.build.json';
import P22HObliterateGear from '../../death_knight/frost/gear_sets/p2.2h-obliterate.gear.json';
import P2MasterfrostGear from '../../death_knight/frost/gear_sets/p2.masterfrost.gear.json';
import P32HObliterateGear from '../../death_knight/frost/gear_sets/p3.2h-obliterate.gear.json';
import P3MasterfrostGear from '../../death_knight/frost/gear_sets/p3.masterfrost.gear.json';
import PrebisMasterfrostGear from '../../death_knight/frost/gear_sets/prebis.masterfrost.gear.json';
import Prebis2HObliterateGear from '../../death_knight/frost/gear_sets/prebis.2h-obliterate.gear.json';

export const P2_2H_OBLITERATE_GEAR_PRESET = PresetUtils.makePresetGear('P2 - 2h Obliterate', P22HObliterateGear);
export const P2_MASTERFROST_GEAR_PRESET = PresetUtils.makePresetGear('P2 - Masterfrost', P2MasterfrostGear);
export const P3_2H_OBLITERATE_GEAR_PRESET = PresetUtils.makePresetGear('P3 - 2h Obliterate', P32HObliterateGear);
export const P3_MASTERFROST_GEAR_PRESET = PresetUtils.makePresetGear('P3 - Masterfrost', P3MasterfrostGear);
export const PREBIS_MASTERFROST_GEAR_PRESET = PresetUtils.makePresetGear('Prebis - Masterfrost', PrebisMasterfrostGear);
export const PREBIS_2H_OBLITERATE_GEAR_PRESET = PresetUtils.makePresetGear('Prebis - 2h Obliterate', Prebis2HObliterateGear);

export const OBLITERATE_ROTATION_PRESET_DEFAULT = PresetUtils.makePresetAPLRotation('Obliterate', ObliterateAPL);
export const MASTERFROST_ROTATION_PRESET_DEFAULT = PresetUtils.makePresetAPLRotation('Masterfrost', MasterFrostAPL);

export const TWOHAND_OBLITERATE_EP_PRESET = PresetUtils.makePresetEpWeights(
	'2h Obliterate',
	Stats.fromMap(
		{
			[Stat.StatStrength]: 1.0,
			[Stat.StatHitRating]: 0.82,
			[Stat.StatExpertiseRating]: 0.82,
			[Stat.StatHasteRating]: 0.45,
			[Stat.StatCritRating]: 0.44,
			[Stat.StatAttackPower]: 0.36,
			[Stat.StatMasteryRating]: 0.35,
		},
		{
			[PseudoStat.PseudoStatMainHandDps]: 2.95,
		},
	),
);

export const MASTERFROST_EP_PRESET = PresetUtils.makePresetEpWeights(
	'Masterfrost',
	Stats.fromMap(
		{
			[Stat.StatStrength]: 1.0,
			[Stat.StatHitRating]: 0.84,
			[Stat.StatExpertiseRating]: 0.83,
			[Stat.StatMasteryRating]: 0.53,
			[Stat.StatHasteRating]: 0.37,
			[Stat.StatAttackPower]: 0.37,
			[Stat.StatCritRating]: 0.36,
		},
		{
			[PseudoStat.PseudoStatMainHandDps]: 1.58,
			[PseudoStat.PseudoStatOffHandDps]: 0.76,
		},
	),
);

// Default talents. Uses the wowhead calculator format, make the talents on
// https://wotlk.wowhead.com/talent-calc and copy the numbers in the url.

export const DefaultTalents = {
	name: 'Default',
	data: SavedTalents.create({
		talentsString: '221111',
		glyphs: Glyphs.create({
			major1: DeathKnightMajorGlyph.GlyphOfDarkSuccor,
			major2: DeathKnightMajorGlyph.GlyphOfPestilence,
			minor1: DeathKnightMinorGlyph.GlyphOfResilientGrip,
			minor2: DeathKnightMinorGlyph.GlyphOfTranquilGrip,
		}),
	}),
};

export const DefaultOptions = FrostDeathKnight_Options.create({
	classOptions: {},
});

export const OtherDefaults = {
	profession1: Profession.Engineering,
	profession2: Profession.Blacksmithing,
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

export const PRESET_BUILD_P2_2H_OBLITERATE = PresetUtils.makePresetBuildFromJSON('P2 - 2h Obliterate', Spec.SpecFrostDeathKnight, P22hObliterateBuild, {
	epWeights: TWOHAND_OBLITERATE_EP_PRESET,
	rotationType: APLRotation_Type.TypeAuto,
});
export const PRESET_BUILD_P2_MASTERFROST = PresetUtils.makePresetBuildFromJSON('P2 - Masterfrost', Spec.SpecFrostDeathKnight, P2MasterfrostBuild, {
	epWeights: MASTERFROST_EP_PRESET,
	rotationType: APLRotation_Type.TypeAuto,
});
export const PRESET_BUILD_P3_2H_OBLITERATE = PresetUtils.makePresetBuildFromJSON('P3 - 2h Obliterate', Spec.SpecFrostDeathKnight, P32hObliterateBuild, {
	epWeights: TWOHAND_OBLITERATE_EP_PRESET,
	rotationType: APLRotation_Type.TypeAuto,
});
export const PRESET_BUILD_P3_MASTERFROST = PresetUtils.makePresetBuildFromJSON('P3 - Masterfrost', Spec.SpecFrostDeathKnight, P3MasterfrostBuild, {
	epWeights: MASTERFROST_EP_PRESET,
	rotationType: APLRotation_Type.TypeAuto,
});
export const PRESET_BUILD_PREBIS_MASTERFROST = PresetUtils.makePresetBuildFromJSON('Prebis - Masterfrost', Spec.SpecFrostDeathKnight, PrebisMasterfrostBuild, {
	epWeights: MASTERFROST_EP_PRESET,
	rotationType: APLRotation_Type.TypeAuto,
});
export const PRESET_BUILD_PREBIS_2H_OBLITERATE = PresetUtils.makePresetBuildFromJSON(
	'Prebis - 2h Obliterate',
	Spec.SpecFrostDeathKnight,
	Prebis2hObliterateBuild,
	{
		epWeights: TWOHAND_OBLITERATE_EP_PRESET,
		rotationType: APLRotation_Type.TypeAuto,
	},
);
