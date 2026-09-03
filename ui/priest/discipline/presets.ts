import * as PresetUtils from '../../core/preset_utils';
import { ConsumesSpec, Glyphs, Profession, Stat } from '../../core/proto/common';
import { DisciplinePriest_Options as DisciplinePriestOptions, PriestMajorGlyph, PriestOptions_Armor } from '../../core/proto/priest';
import { SavedTalents } from '../../core/proto/ui';
import { Stats } from '../../core/proto_utils/stats';
import P5Gear from './gear_sets/p5.gear.json';
import PreraidGear from './gear_sets/preraid.gear.json';

// Preset options for this spec.
// Eventually we will import these values for the raid sim too, so its good to
// keep them in a separate file.
export const PRERAID_PRESET = PresetUtils.makePresetGear('Pre-raid', PreraidGear);
export const P5_PRESET = PresetUtils.makePresetGear('P5 BiS', P5Gear);

// Stat weights from QE Live's MoP Classic model, spell power = 1:
// https://github.com/Voulk/QuestionablyEpic/blob/dev/src/General/Modules/Player/ClassDefaults/Classic/Priest/DisciplinePriestClassic.js
export const DEFAULT_EP_PRESET = PresetUtils.makePresetEpWeights(
	'QE Live',
	Stats.fromMap({
		[Stat.StatIntellect]: 1.28,
		[Stat.StatSpirit]: 0.43,
		[Stat.StatSpellPower]: 1,
		[Stat.StatCritRating]: 0.91,
		[Stat.StatHasteRating]: 0,
		[Stat.StatMasteryRating]: 0.924,
	}),
);

// Default talents. Uses the wowhead calculator format, make the talents on
// https://wowhead.com/mop-classic/talent-calc and copy the numbers in the url.
export const DefaultTalents = {
	name: 'Default',
	data: SavedTalents.create({
		talentsString: '113113',
		glyphs: Glyphs.create({
			major1: PriestMajorGlyph.GlyphOfPenance,
			major2: PriestMajorGlyph.GlyphOfPowerWordShield,
			major3: PriestMajorGlyph.GlyphOfHolyFire,
		}),
	}),
};

export const DefaultOptions = DisciplinePriestOptions.create({
	classOptions: {
		armor: PriestOptions_Armor.InnerFire,
	},
});

export const DefaultConsumables = ConsumesSpec.create({
	flaskId: 76085, // Flask of the Warm Sun
	foodId: 74650, // Mogu Fish Stew
	potId: 76093, // Potion of the Jade Serpent
});

export const OtherDefaults = {
	profession1: Profession.Engineering,
	profession2: Profession.Tailoring,
	distanceFromTarget: 18,
};
