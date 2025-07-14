import * as PresetUtils from '../../core/preset_utils';
import { ConsumesSpec, Glyphs, Profession, PseudoStat, Race, Spec, Stat } from '../../core/proto/common';
import { DeathKnightMajorGlyph, DeathKnightMinorGlyph, FrostDeathKnight_Options } from '../../core/proto/death_knight';
import { SavedTalents } from '../../core/proto/ui';
import { Stats } from '../../core/proto_utils/stats';
import MasterFrostAPL from '../../death_knight/frost/apls/masterfrost.apl.json';
import ObliterateAPL from '../../death_knight/frost/apls/obliterate.apl.json';
import P12hObliterateBuild from '../../death_knight/frost/builds/p1.2h-obliterate.build.json';
import P1MasterfrostBuild from '../../death_knight/frost/builds/p1.masterfrost.build.json';
import PrebisMasterfrostBuild from '../../death_knight/frost/builds/prebis.masterfrost.build.json';
import P12HObliterateGear from '../../death_knight/frost/gear_sets/p1.2h-obliterate.gear.json';
import P1MasterfrostGear from '../../death_knight/frost/gear_sets/p1.masterfrost.gear.json';
import PrebisGear from '../../death_knight/frost/gear_sets/prebis.gear.json';

export const P1_2H_OBLITERATE_GEAR_PRESET = PresetUtils.makePresetGear('P1 - 2h Obliterate', P12HObliterateGear);
export const P1_MASTERFROST_GEAR_PRESET = PresetUtils.makePresetGear('P1 - Masterfrost', P1MasterfrostGear);
export const PREBIS_MASTERFROST_GEAR_PRESET = PresetUtils.makePresetGear('Prebis Masterfrost', PrebisGear);

export const OBLITERATE_ROTATION_PRESET_DEFAULT = PresetUtils.makePresetAPLRotation('Obliterate', ObliterateAPL);
export const MASTERFROST_ROTATION_PRESET_DEFAULT = PresetUtils.makePresetAPLRotation('Masterfrost', MasterFrostAPL);

export const P1_2H_OBLITERATE_EP_PRESET = PresetUtils.makePresetEpWeights(
	'P1 2h Obliterate',
	Stats.fromMap(
		{
			[Stat.StatStrength]: 1.0,
			[Stat.StatHitRating]: 0.87,
			[Stat.StatExpertiseRating]: 0.87,
			[Stat.StatMasteryRating]: 0.35,
			[Stat.StatCritRating]: 0.44,
			[Stat.StatHasteRating]: 0.39,
			[Stat.StatAttackPower]: 0.37,
		},
		{
			[PseudoStat.PseudoStatMainHandDps]: 2.95,
		},
	),
);

export const P1_MASTERFROST_EP_PRESET = PresetUtils.makePresetEpWeights(
	'P1 Masterfrost',
	Stats.fromMap(
		{
			[Stat.StatStrength]: 1.0,
			[Stat.StatHitRating]: 0.73,
			[Stat.StatExpertiseRating]: 0.73,
			[Stat.StatMasteryRating]: 0.5,
			[Stat.StatHasteRating]: 0.47,
			[Stat.StatAttackPower]: 0.37,
			[Stat.StatCritRating]: 0.36,
		},
		{
			[PseudoStat.PseudoStatMainHandDps]: 1.54,
			[PseudoStat.PseudoStatOffHandDps]: 0.74,
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
			major1: DeathKnightMajorGlyph.GlyphOfAntiMagicShell,
			major2: DeathKnightMajorGlyph.GlyphOfPestilence,
			major3: DeathKnightMajorGlyph.GlyphOfLoudHorn,
			minor1: DeathKnightMinorGlyph.GlyphOfArmyOfTheDead,
			minor2: DeathKnightMinorGlyph.GlyphOfTranquilGrip,
			minor3: DeathKnightMinorGlyph.GlyphOfDeathGate,
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
};

export const DefaultConsumables = ConsumesSpec.create({
	flaskId: 76088, // Flask of Winter's Bite
	foodId: 74646, // Black Pepper Ribs and Shrimp
	potId: 76095, // Potion of Mogu Power
	prepotId: 76095, // Potion of Mogu Power
});

export const PRESET_BUILD_2H_OBLITERATE = PresetUtils.makePresetBuildFromJSON('P1 - 2h Obliterate', Spec.SpecFrostDeathKnight, P12hObliterateBuild, {
	epWeights: P1_2H_OBLITERATE_EP_PRESET,
});
export const PRESET_BUILD_MASTERFROST = PresetUtils.makePresetBuildFromJSON('P1 - Masterfrost', Spec.SpecFrostDeathKnight, P1MasterfrostBuild, {
	epWeights: P1_MASTERFROST_EP_PRESET,
});
export const PRESET_BUILD_PREBIS = PresetUtils.makePresetBuildFromJSON('Prebis Masterfrost', Spec.SpecFrostDeathKnight, PrebisMasterfrostBuild, {
	epWeights: P1_MASTERFROST_EP_PRESET,
});
