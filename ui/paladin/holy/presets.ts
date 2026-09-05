import * as PresetUtils from '../../core/preset_utils';
import { ConsumesSpec, Glyphs, Profession, PseudoStat, Stat } from '../../core/proto/common';
import { HolyPaladin_Options as HolyPaladinOptions, PaladinMajorGlyph, PaladinMinorGlyph, PaladinSeal } from '../../core/proto/paladin';
import { SavedTalents } from '../../core/proto/ui';
import { Stats, UnitStat, UnitStatPresets } from '../../core/proto_utils/stats';
import P5Gear from './gear_sets/p5.gear.json';
import PreraidGear from './gear_sets/preraid.gear.json';

// Preset options for this spec.
// Eventually we will import these values for the raid sim too, so its good to
// keep them in a separate file.
export const PRERAID_PRESET = PresetUtils.makePresetGear('Pre-raid', PreraidGear);
export const P5_PRESET = PresetUtils.makePresetGear('P5 BiS', P5Gear);

// Stat weights from QE Live's MoP Classic model, spell power = 1:
// https://github.com/Voulk/QuestionablyEpic/blob/dev/src/General/Modules/Player/ClassDefaults/Classic/Paladin/HolyPaladinClassic.js
export const DEFAULT_EP_PRESET = PresetUtils.makePresetEpWeights(
	'QE Live',
	Stats.fromMap({
		[Stat.StatIntellect]: 1.204,
		[Stat.StatSpirit]: 0.712,
		[Stat.StatSpellPower]: 1,
		[Stat.StatCritRating]: 0.661,
		[Stat.StatHasteRating]: 0.527,
		[Stat.StatMasteryRating]: 1.084,
	}),
);

// Default talents. Uses the wowhead calculator format, make the talents on
// https://wowhead.com/mop-classic/talent-calc and copy the numbers in the url.
export const DefaultTalents = {
	name: 'Default',
	data: SavedTalents.create({
		talentsString: '121312',
		glyphs: Glyphs.create({
			major1: PaladinMajorGlyph.GlyphOfHandOfSacrifice,
			major2: PaladinMajorGlyph.GlyphOfDivinity,
			major3: PaladinMajorGlyph.GlyphOfBeaconOfLight,
			minor1: PaladinMinorGlyph.GlyphOfTheRighteousRetreat,
			minor2: PaladinMinorGlyph.GlyphOfBladedJudgment,
			minor3: PaladinMinorGlyph.GlyphOfWingedVengeance,
		}),
	}),
};

export const DefaultOptions = HolyPaladinOptions.create({
	classOptions: {
		seal: PaladinSeal.Insight,
	},
});

export const DefaultConsumables = ConsumesSpec.create({
	flaskId: 76085, // Flask of the Warm Sun
	foodId: 74650, // Mogu Fish Stew
	potId: 76093, // Potion of the Jade Serpent
});

export const OtherDefaults = {
	profession1: Profession.Engineering,
	profession2: Profession.Jewelcrafting,
	distanceFromTarget: 18,
};

// HoT tick breakpoints as total spell haste percent (raid buff included):
// (ticks - 0.5) / baseTicks - 1. Eternal Flame 30s/3s, Sacred Shield 30s/6s.
export const QE_HASTE_EP_PAST_BREAKPOINT = 0.527;

export const HOLY_BREAKPOINTS: UnitStatPresets[] = [
	{
		unitStat: UnitStat.fromPseudoStat(PseudoStat.PseudoStatSpellHastePercent),
		presets: new Map([
			['11-tick - Eternal Flame', 5],
			['6-tick - Sacred Shield', 10],
			['12-tick - Eternal Flame', 15],
			['13-tick - Eternal Flame', 25],
			['7-tick - Sacred Shield', 30],
			['14-tick - Eternal Flame', 35],
			['15-tick - Eternal Flame', 45],
			['8-tick - Sacred Shield', 50],
		]),
	},
];
