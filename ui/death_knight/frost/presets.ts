import * as PresetUtils from '../../core/preset_utils';
import { Player } from '../../core/player';
import { APLRotation_Type } from '../../core/proto/apl';
import { ConsumesSpec, Glyphs, Profession, PseudoStat, Race, Spec, Stat } from '../../core/proto/common';
import { DeathKnightMajorGlyph, DeathKnightMinorGlyph, FrostDeathKnight_Options } from '../../core/proto/death_knight';
import { SavedTalents } from '../../core/proto/ui';
import { Stats } from '../../core/proto_utils/stats';
import MasterFrostAPL from '../../death_knight/frost/apls/masterfrost.apl.json';
import MasterFrostMalkorokAPL from '../../death_knight/frost/apls/masterfrost-malkorok.apl.json';
import ObliterateAPL from '../../death_knight/frost/apls/obliterate.apl.json';
import ObliterateMalkorokAPL from '../../death_knight/frost/apls/obliterate-malkorok.apl.json';
import P52hObliterateBuild from '../../death_knight/frost/builds/p5.2h-obliterate.build.json';
import P5MasterfrostBuild from '../../death_knight/frost/builds/p5.masterfrost.build.json';
import P5MasterfrostGear from '../../death_knight/frost/gear_sets/p5.masterfrost.gear.json';
import P52HObliterateGear from '../../death_knight/frost/gear_sets/p5.2h-obliterate.gear.json';
import PrebisMasterfrostGear from '../../death_knight/frost/gear_sets/prebis.masterfrost.gear.json';
import Prebis2HObliterateGear from '../../death_knight/frost/gear_sets/prebis.2h-obliterate.gear.json';

export const P5_MASTERFROST_GEAR_PRESET = PresetUtils.makePresetGear('P5 - Masterfrost', P5MasterfrostGear);
export const P5_2H_OBLITERATE_GEAR_PRESET = PresetUtils.makePresetGear('P5 - 2h Obliterate', P52HObliterateGear);
export const PREBIS_MASTERFROST_GEAR_PRESET = PresetUtils.makePresetGear('Prebis - Masterfrost', PrebisMasterfrostGear);
export const PREBIS_2H_OBLITERATE_GEAR_PRESET = PresetUtils.makePresetGear('Prebis - 2h Obliterate', Prebis2HObliterateGear);

// Real creature ID for the Malkorok (DPS) preset target (see sim/encounters/soo/malkorok_ai.go).
const MALKOROK_BOSS_ID = 71454;

const malkorokEncounterWarning = (player: Player<Spec.SpecFrostDeathKnight>) =>
	PresetUtils.makeSpecChangeWarningToast(
		[
			{
				condition: (player: Player<Spec.SpecFrostDeathKnight>) => player.sim.encounter.primaryTarget.id !== MALKOROK_BOSS_ID,
				message: "This rotation's Anti-Magic Shell timing is tuned for the Malkorok (DPS) encounter. Against any other target, that cast becomes an unconditional cast-on-cooldown instead of the intended reactive one.",
			},
		],
		player,
	);

export const OBLITERATE_ROTATION_PRESET_DEFAULT = PresetUtils.makePresetAPLRotation('Obliterate', ObliterateAPL);
export const MASTERFROST_ROTATION_PRESET_DEFAULT = PresetUtils.makePresetAPLRotation('Masterfrost', MasterFrostAPL);
export const OBLITERATE_MALKOROK_ROTATION_PRESET = PresetUtils.makePresetAPLRotation('Obliterate (Malkorok)', ObliterateMalkorokAPL, {
	onLoad: malkorokEncounterWarning,
});
export const MASTERFROST_MALKOROK_ROTATION_PRESET = PresetUtils.makePresetAPLRotation('Masterfrost (Malkorok)', MasterFrostMalkorokAPL, {
	onLoad: malkorokEncounterWarning,
});

export const TWOHAND_OBLITERATE_EP_PRESET = PresetUtils.makePresetEpWeights(
	'2h Obliterate',
	Stats.fromMap(
		{
			[Stat.StatStrength]: 1.0,
			[Stat.StatHitRating]: 1.67,
			[Stat.StatExpertiseRating]: 1.59,
			[Stat.StatHasteRating]: 0.49,
			[Stat.StatCritRating]: 0.62,
			[Stat.StatAttackPower]: 0.37,
			[Stat.StatMasteryRating]: 0.56,
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
			[Stat.StatHitRating]: 1.54,
			[Stat.StatExpertiseRating]: 1.55,
			[Stat.StatMasteryRating]: 0.68,
			[Stat.StatHasteRating]: 0.44,
			[Stat.StatAttackPower]: 0.37,
			[Stat.StatCritRating]: 0.53,
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
			major1: DeathKnightMajorGlyph.GlyphOfRegenerativeMagic,
			major2: DeathKnightMajorGlyph.GlyphOfDeathGrip,
			major3: DeathKnightMajorGlyph.GlyphOfLoudHorn,
			minor1: DeathKnightMinorGlyph.GlyphOfArmyOfTheDead,
			minor2: DeathKnightMinorGlyph.GlyphOfTranquilGrip,
			minor3: DeathKnightMinorGlyph.GlyphOfTheLongWinter,
		}),
	}),
};

export const DefaultOptions = FrostDeathKnight_Options.create({
	classOptions: {},
	amsNumTicks: 1,
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

export const PRESET_BUILD_P5_2H_OBLITERATE = PresetUtils.makePresetBuildFromJSON('P5 - 2h Obliterate', Spec.SpecFrostDeathKnight, P52hObliterateBuild, {
	epWeights: TWOHAND_OBLITERATE_EP_PRESET,
	rotationType: APLRotation_Type.TypeAuto,
});
export const PRESET_BUILD_P5_MASTERFROST = PresetUtils.makePresetBuildFromJSON('P5 - Masterfrost', Spec.SpecFrostDeathKnight, P5MasterfrostBuild, {
	epWeights: MASTERFROST_EP_PRESET,
	rotationType: APLRotation_Type.TypeAuto,
});
