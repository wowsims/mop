import { APLRotation_Type } from '../../core/proto/apl';
import { Player } from '../../core/player';
import * as PresetUtils from '../../core/preset_utils';
import { ConsumesSpec, Glyphs, Profession, PseudoStat, Race, Spec, Stat } from '../../core/proto/common';
import { DeathKnightMajorGlyph, DeathKnightMinorGlyph, UnholyDeathKnight_Options } from '../../core/proto/death_knight';
import { SavedTalents } from '../../core/proto/ui';
import { Stats } from '../../core/proto_utils/stats';
import DefaultApl from '../../death_knight/unholy/apls/default.apl.json';
import FesterblightApl from '../../death_knight/unholy/apls/festerblight.apl.json';
import P2Build from '../../death_knight/unholy/builds/p2.build.json';
import P3Build from '../../death_knight/unholy/builds/p3.build.json';
import PrebisBuild from '../../death_knight/unholy/builds/prebis.build.json';
import P2Gear from '../../death_knight/unholy/gear_sets/p2.gear.json';
import P3Gear from '../../death_knight/unholy/gear_sets/p3.gear.json';
import PrebisGear from '../../death_knight/unholy/gear_sets/prebis.gear.json';

// Preset options for this spec.
// Eventually we will import these values for the raid sim too, so its good to
// keep them in a separate file.
export const PREBIS_GEAR_PRESET = PresetUtils.makePresetGear('Prebis', PrebisGear);
export const P2_BIS_GEAR_PRESET = PresetUtils.makePresetGear('P2', P2Gear);
export const P3_BIS_GEAR_PRESET = PresetUtils.makePresetGear('P3', P3Gear);

export const DEFAULT_ROTATION_PRESET = PresetUtils.makePresetAPLRotation('Default', DefaultApl);
export const FESTERBLIGHT_ROTATION_PRESET = PresetUtils.makePresetAPLRotation('Festerblight', FesterblightApl, {
	onLoad: (player: Player<Spec.SpecUnholyDeathKnight>) =>
		PresetUtils.makeSpecChangeWarningToast(
			[
				{
					condition: (player: Player<Spec.SpecUnholyDeathKnight>) =>
						!player.getGear().hasTrinketFromOptions([95726, 94515, 96470, 96098, 96842]),
					message:
						'You have selected a rotation that requires Fabled Feather of Ji-Kun to be equipped.',
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
			[Stat.StatCritRating]: 0.47,
			[Stat.StatHasteRating]: 0.43,
			[Stat.StatMasteryRating]: 0.4,
			[Stat.StatAttackPower]: 0.3,
		},
		{
			[PseudoStat.PseudoStatMainHandDps]: 0.8,
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
			major3: DeathKnightMajorGlyph.GlyphOfFesteringBlood,
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
			major1: DeathKnightMajorGlyph.GlyphOfAntiMagicShell,
			major2: DeathKnightMajorGlyph.GlyphOfPestilence,
			major3: DeathKnightMajorGlyph.GlyphOfFesteringBlood,
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
export const P2_PRESET = PresetUtils.makePresetBuildFromJSON('P2', Spec.SpecUnholyDeathKnight, P2Build, {
	epWeights: DEFAULT_UNHOLY_EP_PRESET,
	rotationType: APLRotation_Type.TypeAuto,
});
export const P3_PRESET = PresetUtils.makePresetBuildFromJSON('P3', Spec.SpecUnholyDeathKnight, P3Build, {
	epWeights: DEFAULT_UNHOLY_EP_PRESET,
	rotationType: APLRotation_Type.TypeAuto,
});

export const DefaultOptions = UnholyDeathKnight_Options.create({
	classOptions: {},
});

export const OtherDefaults = {
	profession1: Profession.Engineering,
	profession2: Profession.Blacksmithing,
	distanceFromTarget: 5,
	race: Race.RaceOrc,
	iterationCount: 25000,
};

export const DefaultConsumables = ConsumesSpec.create({
	flaskId: 76088, // Flask of Winter's Bite
	foodId: 74646, // Black Pepper Ribs and Shrimp
	potId: 76095, // Potion of Mogu Power
	prepotId: 76095, // Potion of Mogu Power
});
