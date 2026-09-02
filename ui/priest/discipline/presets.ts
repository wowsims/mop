import * as PresetUtils from '@app/preset_utils';
import { Stats } from '@domain/proto_utils/stats';
import { defaultRaidBuffMajorDamageCooldowns } from '@domain/proto_utils/utils';

import { ConsumesSpec, Debuffs, IndividualBuffs, Profession, RaidBuffs, Stat } from '../../core/proto/common';
import { DisciplinePriest_Options as Options, PriestOptions_Armor } from '../../core/proto/priest';
import { SavedTalents } from '../../core/proto/ui';
import DefaultApl from './apls/default.apl.json';
import P1Gear from './gear_sets/p1.gear.json';

// Preset options for this spec.
// Eventually we will import these values for the raid sim too, so its good to
// keep them in a separate file.
export const P1_PRESET = PresetUtils.makePresetGear('P1 Preset', P1Gear);

export const ROTATION_PRESET_DEFAULT = PresetUtils.makePresetAPLRotation('Default', DefaultApl);

// Preset options for EP weights
export const P1_EP_PRESET = PresetUtils.makePresetEpWeights(
	'P1',
	Stats.fromMap({
		[Stat.StatIntellect]: 0.11,
		[Stat.StatSpirit]: 0.47,
		[Stat.StatSpellPower]: 1,
		[Stat.StatHitRating]: 0.87,
		[Stat.StatCritRating]: 0.74,
		[Stat.StatHasteRating]: 1.65,
		[Stat.StatMP5]: 0.0,
	}),
);

// Default talents. Uses the wowhead calculator format, make the talents on
// https://wowhead.com/mop-classic/talent-calc and copy the numbers in the url.
export const StandardTalents = {
	name: 'Standard',
	data: SavedTalents.create({
		// talentsString: '05032031--325023051223010323151301351',
		// glyphs: Glyphs.create({
		// 	major1: MajorGlyph.GlyphOfShadow,
		// 	major2: MajorGlyph.GlyphOfMindFlay,
		// 	major3: MajorGlyph.GlyphOfDispersion,
		// 	minor1: MinorGlyph.GlyphOfFortitude,
		// 	minor2: MinorGlyph.GlyphOfShadowProtection,
		// 	minor3: MinorGlyph.GlyphOfShadowfiend,
		// }),
	}),
};

export const EnlightenmentTalents = {
	name: 'Enlightenment',
	data: SavedTalents.create({
		// talentsString: '05032031303005022--3250230012230101231513011',
		// glyphs: Glyphs.create({
		// 	major1: MajorGlyph.GlyphOfShadow,
		// 	major2: MajorGlyph.GlyphOfMindFlay,
		// 	major3: MajorGlyph.GlyphOfShadowWordDeath,
		// 	minor1: MinorGlyph.GlyphOfFortitude,
		// 	minor2: MinorGlyph.GlyphOfShadowProtection,
		// 	minor3: MinorGlyph.GlyphOfShadowfiend,
		// }),
	}),
};

export const DefaultOptions = Options.create({
	classOptions: {
		armor: PriestOptions_Armor.InnerFire,
	},
});

export const DefaultConsumables = ConsumesSpec.create({
	flaskId: 123, // Flask of the Frost Wyrm (not found in list)
	foodId: 62290, // Seafood Magnifique Feast
	potId: 58091, // Volcanic Potion
	prepotId: 58091, // Volcanic Potion
});
export const DefaultRaidBuffs = RaidBuffs.create({
	...defaultRaidBuffMajorDamageCooldowns()
});

export const DefaultIndividualBuffs = IndividualBuffs.create({});

export const DefaultDebuffs = Debuffs.create({
	// bloodFrenzy: true,
	// sunderArmor: true,
	// ebonPlaguebringer: true,
	// mangle: true,
	// criticalMass: true,
	// demoralizingShout: true,
	// frostFever: true,
});

export const OtherDefaults = {
	channelClipDelay: 100,
	profession1: Profession.Engineering,
	profession2: Profession.Tailoring,
};
