import { Encounter } from '../../core/encounter';
import * as PresetUtils from '../../core/preset_utils';
import { ConsumesSpec, Glyphs, Profession, Race, Stat } from '../../core/proto/common';
import { FrostMage_Options as MageOptions, MageMajorGlyph, MageMinorGlyph, MageArmor } from '../../core/proto/mage';
import { SavedTalents } from '../../core/proto/ui';
import { Stats } from '../../core/proto_utils/stats';
import FrostApl from './apls/frost.apl.json';
import FrostAoeApl from './apls/frost_aoe.apl.json';
import P1PreBISGear from './gear_sets/p1_prebis.gear.json';
import P1BISGear from './gear_sets/p1_bis.gear.json';
import P2BSISGear from './gear_sets/p2_bis.gear.json';
import P3BSISGear from './gear_sets/p3_bis.gear.json';
import P4BISGear from './gear_sets/p4_bis.gear.json';
// Preset options for this spec.
// Eventually we will import these values for the raid sim too, so its good to
// keep them in a separate file.

export const P1_PREBIS = PresetUtils.makePresetGear('P1 - Pre-BIS', P1PreBISGear);
export const P1_BIS = PresetUtils.makePresetGear('P1 - BIS', P1BISGear);
export const P2_BIS = PresetUtils.makePresetGear('P2 - BIS', P2BSISGear);
export const P3_BIS = PresetUtils.makePresetGear('P3 - BIS', P3BSISGear);
export const P4_BIS = PresetUtils.makePresetGear('P4 - BIS', P4BISGear);

export const ROTATION_PRESET_DEFAULT = PresetUtils.makePresetAPLRotation('Default', FrostApl);
export const ROTATION_PRESET_AOE = PresetUtils.makePresetAPLRotation('AOE', FrostAoeApl);
// export const ROTATION_PRESET_CLEAVE = PresetUtils.makePresetAPLRotation('Cleave', FrostCleaveApl);

// Preset options for EP weights
export const P3_BIS_EP_PRESET = PresetUtils.makePresetEpWeights(
	'Item Level >= 517',
	Stats.fromMap({
		[Stat.StatIntellect]: 1.23,
		[Stat.StatSpellPower]: 1,
		[Stat.StatHitRating]: 1.55,
		[Stat.StatCritRating]: 0.54,
		[Stat.StatHasteRating]: 0.81,
		[Stat.StatMasteryRating]: 0.52,
	}),
);

export const P1_BIS_EP_PRESET = PresetUtils.makePresetEpWeights(
	'Item Level >= 500',
	Stats.fromMap({
		[Stat.StatIntellect]: 1.26,
		[Stat.StatSpellPower]: 1,
		[Stat.StatHitRating]: 1.30,
		[Stat.StatCritRating]: 0.61,
		[Stat.StatHasteRating]: 0.74,
		[Stat.StatMasteryRating]: 0.52,
	}),
);

export const P1_PREBIS_EP_PRESET = PresetUtils.makePresetEpWeights(
	'Item Level < 500',
	Stats.fromMap({
		[Stat.StatIntellect]: 1.25,
		[Stat.StatSpellPower]: 1.0,
		[Stat.StatHitRating]: 1.55,
		[Stat.StatCritRating]: 0.55,
		[Stat.StatHasteRating]: 0.62,
		[Stat.StatMasteryRating]: 0.5,
	}),
);

// Default talents. Uses the wowhead calculator format, make the talents on
// https://wowhead.com/wotlk/talent-calc and copy the numbers in the url.

export const FrostDefaultTalents = {
	name: 'Default',
	data: SavedTalents.create({
		talentsString: '311122',
		glyphs: Glyphs.create({
			major1: MageMajorGlyph.GlyphOfSplittingIce,
			major2: MageMajorGlyph.GlyphOfIcyVeins,
			major3: MageMajorGlyph.GlyphOfWaterElemental,
			minor1: MageMinorGlyph.GlyphOfMomentum,
			minor2: MageMinorGlyph.GlyphOfLooseMana,
			minor3: MageMinorGlyph.GlyphOfTheUnboundElemental,
		}),
	}),
};

export const DefaultConsumables = ConsumesSpec.create({
	flaskId: 76085, // Flask of the Warm Sun
	foodId: 74650, // Mogu Fish Stew
	potId: 76093, // Potion of the Jade Serpent
	prepotId: 76093, // Potion of the Jade Serpent
});

export const FrostTalentsCleave = {
	name: 'Cleave',
	data: SavedTalents.create({
		talentsString: '311122',
		glyphs: Glyphs.create({
			major1: MageMajorGlyph.GlyphOfSplittingIce,
			major2: MageMajorGlyph.GlyphOfIcyVeins,
			major3: MageMajorGlyph.GlyphOfWaterElemental,
			minor1: MageMinorGlyph.GlyphOfMomentum,
			minor2: MageMinorGlyph.GlyphOfLooseMana,
			minor3: MageMinorGlyph.GlyphOfTheUnboundElemental,
		}),
	}),
};

export const FrostTalentsAoE = {
	name: 'AoE (5+)',
	data: SavedTalents.create({
		talentsString: '311112',
		glyphs: Glyphs.create({
			major1: MageMajorGlyph.GlyphOfSplittingIce,
			major2: MageMajorGlyph.GlyphOfIcyVeins,
			major3: MageMajorGlyph.GlyphOfWaterElemental,
			minor1: MageMinorGlyph.GlyphOfMomentum,
			minor2: MageMinorGlyph.GlyphOfLooseMana,
			minor3: MageMinorGlyph.GlyphOfTheUnboundElemental,
		}),
	}),
};

export const DefaultFrostOptions = MageOptions.create({
	classOptions: {
		defaultMageArmor: MageArmor.MageArmorFrostArmor,
	},
});

export const OtherDefaults = {
	distanceFromTarget: 20,
	profession1: Profession.Engineering,
	profession2: Profession.Tailoring,
	race: Race.RaceOrc,
};

export const ENCOUNTER_SINGLE_TARGET = PresetUtils.makePresetEncounter('Single Target', Encounter.defaultEncounterProto());
export const ENCOUNTER_CLEAVE = PresetUtils.makePresetEncounter('Cleave', Encounter.defaultEncounterProto(2));
export const ENCOUNTER_AOE = PresetUtils.makePresetEncounter('AoE (5+)', Encounter.defaultEncounterProto(5));

export const P1_PRESET_BUILD_DEFAULT = PresetUtils.makePresetBuild('Single Target', {
	talents: FrostDefaultTalents,
	rotation: ROTATION_PRESET_DEFAULT,
	encounter: ENCOUNTER_SINGLE_TARGET,
});

export const P1_PRESET_BUILD_CLEAVE = PresetUtils.makePresetBuild('Cleave', {
	talents: FrostTalentsCleave,
	rotation: ROTATION_PRESET_DEFAULT,
	encounter: ENCOUNTER_CLEAVE,
});

export const P1_PRESET_BUILD_AOE = PresetUtils.makePresetBuild('AoE (5+)', {
	talents: FrostTalentsAoE,
	rotation: ROTATION_PRESET_AOE,
	encounter: ENCOUNTER_AOE,
});
