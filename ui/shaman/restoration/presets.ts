import * as PresetUtils from '../../core/preset_utils';
import { ConsumesSpec, Glyphs, Profession, PseudoStat, Stat } from '../../core/proto/common';
import { RestorationShaman_Options as RestorationShamanOptions, ShamanMajorGlyph, ShamanMinorGlyph, ShamanShield } from '../../core/proto/shaman';
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
// https://github.com/Voulk/QuestionablyEpic/blob/dev/src/General/Modules/Player/ClassDefaults/Classic/Shaman/RestoShamanClassic.js
export const DEFAULT_EP_PRESET = PresetUtils.makePresetEpWeights(
	'QE Live',
	Stats.fromMap({
		[Stat.StatIntellect]: 1.269,
		[Stat.StatSpirit]: 0.457,
		[Stat.StatSpellPower]: 1,
		[Stat.StatCritRating]: 0.874,
		[Stat.StatHasteRating]: 0.687,
		[Stat.StatMasteryRating]: 0.718,
	}),
);

// Default talents. Uses the wowhead calculator format, make the talents on
// https://wowhead.com/mop-classic/talent-calc and copy the numbers in the url.
export const DefaultTalents = {
	name: 'Default',
	data: SavedTalents.create({
		talentsString: '331132',
		glyphs: Glyphs.create({
			major1: ShamanMajorGlyph.GlyphOfSpiritwalkersGrace,
			major2: ShamanMajorGlyph.GlyphOfHealingStreamTotem,
			major3: ShamanMajorGlyph.GlyphOfTelluricCurrents,
			minor1: ShamanMinorGlyph.GlyphOfTheSpectralWolf,
			minor2: ShamanMinorGlyph.GlyphOfTheLakestrider,
			minor3: ShamanMinorGlyph.GlyphOfSpiritWolf,
		}),
	}),
};

export const DefaultOptions = RestorationShamanOptions.create({
	classOptions: {
		shield: ShamanShield.WaterShield,
	},
	earthShieldPPM: 0,
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
// (ticks - 0.5) / baseTicks - 1. Riptide 18s/3s, Healing Rain 10s/2s, Earthliving 12s/3s.
export const RESTORATION_BREAKPOINTS: UnitStatPresets[] = [
	{
		unitStat: UnitStat.fromPseudoStat(PseudoStat.PseudoStatSpellHastePercent),
		presets: new Map([
			['7-tick - Riptide', 8.33334],
			['6-tick - Healing Rain', 10],
			['5-tick - Earthliving', 12.5],
			['8-tick - Riptide', 25],
			['7-tick - Healing Rain', 30],
			['6-tick - Earthliving', 37.5],
			['9-tick - Riptide', 41.66667],
			['8-tick - Healing Rain', 50],
			['10-tick - Riptide', 58.33334],
		]),
	},
];
