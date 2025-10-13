import { Encounter } from '../../core/encounter';
import * as PresetUtils from '../../core/preset_utils';
import { ConsumesSpec, Glyphs, Profession, PseudoStat, Spec, Stat } from '../../core/proto/common';
import { BrewmasterMonk_Options as BrewmasterMonkOptions, MonkMajorGlyph, MonkMinorGlyph } from '../../core/proto/monk';
import { SavedTalents } from '../../core/proto/ui';
import { Stats } from '../../core/proto_utils/stats';
import DefaultApl from './apls/default.apl.json';
import GarajalApl from './apls/garajal.apl.json';
import OffensiveApl from './apls/offensive.apl.json';
import ShaApl from './apls/sha.apl.json';
import GarajalBuild from './builds/garajal_default.build.json';
import ShaBuild from './builds/sha_default.build.json';
import P1BISDWGear from './gear_sets/p1_bis_dw.gear.json';
import P2BISDWGear from './gear_sets/p2_bis_dw.gear.json';

// Preset options for this spec.
// Eventually we will import these values for the raid sim too, so its good to
// keep them in a separate file.

export const P1_BIS_DW_GEAR_PRESET = PresetUtils.makePresetGear('P1 BiS - Balanced', P1BISDWGear);
export const P2_BIS_DW_GEAR_PRESET = PresetUtils.makePresetGear('P2 BiS - Balanced', P2BISDWGear);

export const ROTATION_PRESET = PresetUtils.makePresetAPLRotation('Generic', DefaultApl);
export const ROTATION_GARAJAL_PRESET = PresetUtils.makePresetAPLRotation("Gara'jal", GarajalApl);
export const ROTATION_OFFENSIVE_PRESET = PresetUtils.makePresetAPLRotation('Offensive', OffensiveApl);
export const ROTATION_SHA_PRESET = PresetUtils.makePresetAPLRotation('Sha of Fear', ShaApl);

// Preset options for EP weights
export const PREPATCH_EP_PRESET = PresetUtils.makePresetEpWeights(
	'Default',
	Stats.fromMap(
		{
			[Stat.StatAgility]: 1,
			[Stat.StatStamina]: 0.81,
			[Stat.StatArmor]: 0.41,
			[Stat.StatBonusArmor]: 0.41,
			[Stat.StatAttackPower]: 0.24,
			[Stat.StatCritRating]: 0.67,
			[Stat.StatDodgeRating]: 0.20,
			[Stat.StatParryRating]: 0.23,
			[Stat.StatHitRating]: 1.28,
			[Stat.StatExpertiseRating]: 0.96,
			[Stat.StatHasteRating]: 0.42,
			[Stat.StatMasteryRating]: 0.65,
		},
		{
			[PseudoStat.PseudoStatMainHandDps]: 1.50,
			[PseudoStat.PseudoStatOffHandDps]: 0.74,
		},
	),
);

// Default talents. Uses the wowhead calculator format, make the talents on
// https://wowhead.com/mop/talent-calc and copy the numbers in the url.

export const DefaultTalents = {
	name: 'Default',
	data: SavedTalents.create({
		talentsString: '213322',
		glyphs: Glyphs.create({
			major1: MonkMajorGlyph.GlyphOfFortifyingBrew,
			major2: MonkMajorGlyph.GlyphOfEnduringHealingSphere,
			major3: MonkMajorGlyph.GlyphOfFortuitousSpheres,
			minor1: MonkMinorGlyph.GlyphOfSpiritRoll,
			minor2: MonkMinorGlyph.GlyphOfJab,
			minor3: MonkMinorGlyph.GlyphOfWaterRoll,
		}),
	}),
};

export const DungeonTalents = {
	name: 'Dungeon',
	data: SavedTalents.create({
		talentsString: '213321',
		glyphs: Glyphs.create({
			major1: MonkMajorGlyph.GlyphOfFortifyingBrew,
			major2: MonkMajorGlyph.GlyphOfBreathOfFire,
			major3: MonkMajorGlyph.GlyphOfRapidRolling,
			minor1: MonkMinorGlyph.GlyphOfSpiritRoll,
			minor2: MonkMinorGlyph.GlyphOfJab,
			minor3: MonkMinorGlyph.GlyphOfWaterRoll,
		}),
	}),
};

export const DefaultOptions = BrewmasterMonkOptions.create({
	classOptions: {},
});

export const DefaultConsumables = ConsumesSpec.create({
	flaskId: 76087, // Flask of Spring Blossoms
	foodId: 74648, // Sea Mist Rice Noodles
	prepotId: 76090, // Potion of the Mountains
	potId: 76090, // Potion of the Mountains
});

export const OtherDefaults = {
	profession1: Profession.Engineering,
	profession2: Profession.Blacksmithing,
	distanceFromTarget: 5,
	iterationCount: 25000,
};

export const PRESET_BUILD_GARAJAL = PresetUtils.makePresetBuildFromJSON("Gara'jal", Spec.SpecBrewmasterMonk, GarajalBuild);
export const PRESET_BUILD_SHA = PresetUtils.makePresetBuildFromJSON("Sha of Fear", Spec.SpecBrewmasterMonk, ShaBuild);
