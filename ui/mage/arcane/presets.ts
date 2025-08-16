import { Encounter } from '../../core/encounter';
import * as PresetUtils from '../../core/preset_utils';
import { ConsumesSpec, Glyphs, Profession, Race, Stat } from '../../core/proto/common';
import { ArcaneMage_Options as MageOptions, MageMajorGlyph as MajorGlyph, MageMinorGlyph, MageArmor } from '../../core/proto/mage';
import { SavedTalents } from '../../core/proto/ui';
import { Stats } from '../../core/proto_utils/stats';
import ArcaneApl from './apls/default.apl.json';
import ArcaneCleaveApl from './apls/arcane_cleave.apl.json';
import P1PostMSVGear from './gear_sets/p1_post_msv.gear.json';
import P1PostHOFGear from './gear_sets/p1_post_hof.gear.json';
import P1BISGear from './gear_sets/p1_bis.gear.json';

// Preset options for this spec.
// Eventually we will import these values for the raid sim too, so its good to
// keep them in a separate file.
export const P1_POST_MSV = PresetUtils.makePresetGear('P1 - Post-MSV', P1PostMSVGear);
export const P1_POST_HOF = PresetUtils.makePresetGear('P1 - Post-HoF', P1PostHOFGear);
export const P1_BIS = PresetUtils.makePresetGear('P1 - BIS', P1BISGear);

export const ROTATION_PRESET_DEFAULT = PresetUtils.makePresetAPLRotation('Default', ArcaneApl);
// export const ROTATION_PRESET_CLEAVE = PresetUtils.makePresetAPLRotation('Cleave', ArcaneCleaveApl);

// Preset options for EP weights
export const P1_EP_PRESET = PresetUtils.makePresetEpWeights(
	'Default',
	Stats.fromMap({
		[Stat.StatIntellect]: 1.24,
		[Stat.StatSpellPower]: 1,
		[Stat.StatHitRating]: 1.31,
		[Stat.StatCritRating]: 0.52,
		[Stat.StatHasteRating]: 0.6,
		[Stat.StatMasteryRating]: 0.62,
	}),
);

// Breakpoint-specific EP weights (using distinct test values to verify automatic switching)
export const P1_EP_5_TICK = PresetUtils.makePresetEpWeights(
	'5-tick Living Bomb (12.51%)',
	Stats.fromMap({
		[Stat.StatIntellect]: 1.24,
		[Stat.StatSpellPower]: 1,
		[Stat.StatHitRating]: 0.80,
		[Stat.StatCritRating]: 0.52,
		[Stat.StatHasteRating]: 0.69, // REAL: Calculated at 12.507036% haste breakpoint
		[Stat.StatMasteryRating]: 0.63,
	}),
);

export const P1_EP_6_TICK = PresetUtils.makePresetEpWeights(
	'6-tick Living Bomb (37.52%)',
	Stats.fromMap({
		[Stat.StatIntellect]: 1.24,
		[Stat.StatSpellPower]: 1,
		[Stat.StatHitRating]: 0.80,
		[Stat.StatCritRating]: 0.53,
		[Stat.StatHasteRating]: 0.57, // REAL: Calculated at 37.520061% haste breakpoint
		[Stat.StatMasteryRating]: 0.65,
	}),
);

// Unrealistic breakpoints - too high haste to be achievable in practice
// export const P1_EP_7_TICK = PresetUtils.makePresetEpWeights(
// 	'7-tick Living Bomb (62.47%)',
// 	Stats.fromMap({
// 		[Stat.StatIntellect]: 1.24,
// 		[Stat.StatSpellPower]: 1,
// 		[Stat.StatHitRating]: 1.31,
// 		[Stat.StatCritRating]: 0.52,
// 		[Stat.StatHasteRating]: 0.40, // TEST: Lower haste value for 7-tick
// 		[Stat.StatMasteryRating]: 0.62,
// 	}),
// );

export const P1_EP_7_TICK_LUST = PresetUtils.makePresetEpWeights(
	'7-tick LB w/ Lust (24.98%)',
	Stats.fromMap({
		[Stat.StatIntellect]: 1.24,
		[Stat.StatSpellPower]: 1,
		[Stat.StatHitRating]: 0.80,
		[Stat.StatCritRating]: 0.53,
		[Stat.StatHasteRating]: 0.59, // REAL: Calculated at 24.9766% haste breakpoint
		[Stat.StatMasteryRating]: 0.63,
	}),
);

// export const P1_EP_8_TICK = PresetUtils.makePresetEpWeights(
// 	'8-tick Living Bomb (87.44%)',
// 	Stats.fromMap({
// 		[Stat.StatIntellect]: 1.24,
// 		[Stat.StatSpellPower]: 1,
// 		[Stat.StatHitRating]: 1.31,
// 		[Stat.StatCritRating]: 0.52,
// 		[Stat.StatHasteRating]: 0.30, // TEST: Low haste value for 8-tick
// 		[Stat.StatMasteryRating]: 0.62,
// 	}),
// );

// export const P1_EP_9_TICK = PresetUtils.makePresetEpWeights(
// 	'9-tick Living Bomb (112.54%)',
// 	Stats.fromMap({
// 		[Stat.StatIntellect]: 1.24,
// 		[Stat.StatSpellPower]: 1,
// 		[Stat.StatHitRating]: 1.31,
// 		[Stat.StatCritRating]: 0.52,
// 		[Stat.StatHasteRating]: 0.20, // TEST: Very low haste value for 9-tick
// 		[Stat.StatMasteryRating]: 0.62,
// 	}),
// );

// Default talents. Uses the wowhead calculator format, make the talents on
// https://wowhead.com/mop-classic/talent-calc and copy the numbers in the url.
export const ArcaneTalents = {
	name: 'Default',
	data: SavedTalents.create({
		talentsString: '311122',
		glyphs: Glyphs.create({
			major1: MajorGlyph.GlyphOfArcanePower,
			major2: MajorGlyph.GlyphOfRapidDisplacement,
			major3: MajorGlyph.GlyphOfConeOfCold,
			minor1: MageMinorGlyph.GlyphOfMomentum,
			minor2: MageMinorGlyph.GlyphOfRapidTeleportation,
			minor3: MageMinorGlyph.GlyphOfLooseMana,
		}),
	}),
};

export const ArcaneTalentsCleave = {
	name: 'Cleave',
	data: SavedTalents.create({
		talentsString: '311112',
		glyphs: Glyphs.create({
			major1: MajorGlyph.GlyphOfArcanePower,
			major2: MajorGlyph.GlyphOfRapidDisplacement,
			major3: MajorGlyph.GlyphOfConeOfCold,
			minor1: MageMinorGlyph.GlyphOfMomentum,
			minor2: MageMinorGlyph.GlyphOfRapidTeleportation,
			minor3: MageMinorGlyph.GlyphOfLooseMana,
		}),
	}),
};

export const ENCOUNTER_SINGLE_TARGET = PresetUtils.makePresetEncounter('Single Target', Encounter.defaultEncounterProto());
export const ENCOUNTER_CLEAVE = PresetUtils.makePresetEncounter('Cleave (2 targets)', Encounter.defaultEncounterProto(2));

export const P1_PRESET_BUILD_DEFAULT = PresetUtils.makePresetBuild('Single Target', {
	talents: ArcaneTalents,
	rotation: ROTATION_PRESET_DEFAULT,
	encounter: ENCOUNTER_SINGLE_TARGET,
});

export const P1_PRESET_BUILD_CLEAVE = PresetUtils.makePresetBuild('Cleave (2 targets)', {
	talents: ArcaneTalentsCleave,
	rotation: ROTATION_PRESET_DEFAULT,
	encounter: ENCOUNTER_CLEAVE,
});

export const DefaultArcaneOptions = MageOptions.create({
	classOptions: {
		defaultMageArmor: MageArmor.MageArmorFrostArmor,
	},
});
export const DefaultConsumables = ConsumesSpec.create({
	flaskId: 76085, // Flask of the Warm Sun
	foodId: 74650, // Mogu Fish Stew
	potId: 76093, // Potion of the Jade Serpent
	prepotId: 76093, // Potion of the Jade Serpent
});

export const OtherDefaults = {
	distanceFromTarget: 20,
	profession1: Profession.Engineering,
	profession2: Profession.Tailoring,
	race: Race.RaceTroll,
};
