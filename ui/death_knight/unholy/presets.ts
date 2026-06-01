import { APLRotation_Type } from '../../core/proto/apl';
import { Player } from '../../core/player';
import * as PresetUtils from '../../core/preset_utils';
import { ConsumesSpec, Glyphs, Profession, PseudoStat, Race, Spec, Stat } from '../../core/proto/common';
import { DeathKnightMajorGlyph, DeathKnightMinorGlyph, UnholyDeathKnight_Options } from '../../core/proto/death_knight';
import { SavedTalents } from '../../core/proto/ui';
import { Stats } from '../../core/proto_utils/stats';
import DefaultApl from '../../death_knight/unholy/apls/default.apl.json';
import FesterblightApl from '../../death_knight/unholy/apls/festerblight.apl.json';
import P5Build from '../../death_knight/unholy/builds/p5.build.json';
import PrebisBuild from '../../death_knight/unholy/builds/prebis.build.json';
import P5Gear from '../../death_knight/unholy/gear_sets/p5.gear.json';
import PrebisGear from '../../death_knight/unholy/gear_sets/prebis.gear.json';

// Preset options for this spec.
// Eventually we will import these values for the raid sim too, so its good to
// keep them in a separate file.
export const PREBIS_GEAR_PRESET = PresetUtils.makePresetGear('Prebis', PrebisGear);
export const P5_BIS_GEAR_PRESET = PresetUtils.makePresetGear('P5', P5Gear);

export const DEFAULT_ROTATION_PRESET = PresetUtils.makePresetAPLRotation('Default', DefaultApl);
export const FESTERBLIGHT_ROTATION_PRESET = PresetUtils.makePresetAPLRotation('Festerblight', FesterblightApl, {
	onLoad: (player: Player<Spec.SpecUnholyDeathKnight>) =>
		PresetUtils.makeSpecChangeWarningToast(
			[
				{
					condition: (player: Player<Spec.SpecUnholyDeathKnight>) => player.sim.encounter.targets.length > 1,
					message: 'Festerblight is a single-target rotation. Use the Default rotation for multiple targets.',
				},
			],
			player,
		),
});

// Preset options for EP weights
export const DEFAULT_UNHOLY_EP_PRESET = PresetUtils.makePresetEpWeights(
	'Default',
	Stats.fromMap(
		{
			[Stat.StatStrength]: 1.0,
			[Stat.StatHitRating]: 0.73,
			[Stat.StatExpertiseRating]: 0.73,
			[Stat.StatCritRating]: 0.65,
			[Stat.StatHasteRating]: 0.52,
			[Stat.StatMasteryRating]: 0.51,
			[Stat.StatAttackPower]: 0.3,
		},
		{
			[PseudoStat.PseudoStatMainHandDps]: 0.67,
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
			major1: DeathKnightMajorGlyph.GlyphOfRegenerativeMagic,
			major2: DeathKnightMajorGlyph.GlyphOfPestilence,
			major3: DeathKnightMajorGlyph.GlyphOfLoudHorn,
			minor1: DeathKnightMinorGlyph.GlyphOfArmyOfTheDead,
			minor2: DeathKnightMinorGlyph.GlyphOfTranquilGrip,
			minor3: DeathKnightMinorGlyph.GlyphOfDeathsEmbrace,
		}),
	}),
};

export const FesterblightTalents = {
	name: 'Festerblight',
	data: SavedTalents.create({
		talentsString: '321111',
		glyphs: Glyphs.create({
			major1: DeathKnightMajorGlyph.GlyphOfRegenerativeMagic,
			major2: DeathKnightMajorGlyph.GlyphOfPestilence,
			major3: DeathKnightMajorGlyph.GlyphOfLoudHorn,
			minor1: DeathKnightMinorGlyph.GlyphOfArmyOfTheDead,
			minor2: DeathKnightMinorGlyph.GlyphOfTranquilGrip,
			minor3: DeathKnightMinorGlyph.GlyphOfDeathsEmbrace,
		}),
	}),
};

export const PREBIS_PRESET = PresetUtils.makePresetBuildFromJSON('Prebis', Spec.SpecUnholyDeathKnight, PrebisBuild, {
	epWeights: DEFAULT_UNHOLY_EP_PRESET,
	rotationType: APLRotation_Type.TypeAuto,
});
export const P5_PRESET = PresetUtils.makePresetBuildFromJSON('P5', Spec.SpecUnholyDeathKnight, P5Build, {
	epWeights: DEFAULT_UNHOLY_EP_PRESET,
	rotationType: APLRotation_Type.TypeAuto,
});

export const DefaultOptions = UnholyDeathKnight_Options.create({
	classOptions: {},
	avgAmsHit: 170000,
	avgAmsSuccessRate: 1,
});

export const OtherDefaults = {
	profession1: Profession.Engineering,
	profession2: Profession.Herbalism,
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
