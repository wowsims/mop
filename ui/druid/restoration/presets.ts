import * as PresetUtils from '../../core/preset_utils';
import { ConsumesSpec, Glyphs, Profession, PseudoStat, Stat, UnitReference } from '../../core/proto/common';
import { DruidMajorGlyph, RestorationDruid_Options as RestorationDruidOptions } from '../../core/proto/druid';
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
// https://github.com/Voulk/QuestionablyEpic/blob/dev/src/General/Modules/Player/ClassDefaults/Classic/Druid/RestoDruidClassic.js
// QE Live reforges to the 5-tick Rejuvenation breakpoint before applying its weights (haste 0.7).
// Haste sits just above mastery here so the reforge optimizer reaches that breakpoint too; past the
// threshold it falls back to QE's 0.7 (see the haste threshold in sim.ts).
export const DEFAULT_EP_PRESET = PresetUtils.makePresetEpWeights(
	'QE Live',
	Stats.fromMap({
		[Stat.StatIntellect]: 1.211,
		[Stat.StatSpirit]: 1.022,
		[Stat.StatSpellPower]: 1,
		[Stat.StatCritRating]: 0.683,
		[Stat.StatHasteRating]: 0.9,
		[Stat.StatMasteryRating]: 0.89,
	}),
);

// Default talents. Uses the wowhead calculator format, make the talents on
// https://wowhead.com/mop-classic/talent-calc and copy the numbers in the url.
export const DefaultTalents = {
	name: 'Default',
	data: SavedTalents.create({
		talentsString: '113222',
		glyphs: Glyphs.create({
			major1: DruidMajorGlyph.GlyphOfWildGrowth,
			major2: DruidMajorGlyph.GlyphOfRejuvenation,
			major3: DruidMajorGlyph.GlyphOfRegrowth,
		}),
	}),
};

export const DefaultOptions = RestorationDruidOptions.create({
	classOptions: {
		innervateTarget: UnitReference.create(),
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
// (ticks - 0.5) / baseTicks - 1. Rejuvenation 12s/3s, Wild Growth 7s/1s, Regrowth 6s/2s.
export const QE_HASTE_EP_PAST_BREAKPOINT = 0.7;

export const RESTORATION_BREAKPOINTS: UnitStatPresets[] = [
	{
		unitStat: UnitStat.fromPseudoStat(PseudoStat.PseudoStatSpellHastePercent),
		presets: new Map([
			['8-tick - WG', 7.14286],
			['5-tick - Rejuv', 12.5],
			['4-tick - Regrowth', 16.66667],
			['9-tick - WG', 21.42858],
			['10-tick - WG', 35.71429],
			['6-tick - Rejuv', 37.5],
			['11-tick - WG', 50],
			['7-tick - Rejuv', 62.5],
		]),
	},
];
