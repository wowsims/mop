import * as PresetUtils from '../../core/preset_utils';
import { ConsumesSpec, Glyphs, Profession, PseudoStat, Spec, Stat } from '../../core/proto/common';
import { BrewmasterMonk_Options as BrewmasterMonkOptions, MonkMajorGlyph, MonkMinorGlyph } from '../../core/proto/monk';
import { SavedTalents } from '../../core/proto/ui';
import { Stats } from '../../core/proto_utils/stats';
import DefaultApl from './apls/default.apl.json';
import GarajalApl from './apls/garajal.apl.json';
import OffensiveApl from './apls/offensive.apl.json';
import ShaApl from './apls/sha.apl.json';
import HorridonApl from './apls/horridon.apl.json';
import GarajalBuild from './builds/garajal_encounter_only.build.json';
import ShaBuild from './builds/sha_encounter_only.build.json';
import HorridonBuild from './builds/horridon_encounter_only.build.json';
import PreBISGear from './gear_sets/prebis.gear.json';
import P1BISDWGear from './gear_sets/p1_bis_dw.gear.json';
import P2BISDWGear from './gear_sets/p2_bis_dw.gear.json';
import P3BISDWGear from './gear_sets/p3_bis_dw.gear.json';
import P3OffensiveDWGear from './gear_sets/p3_bis_offensive_dw.gear.json';
import P2BISOffensiveDWGear from './gear_sets/p2_bis_offensive_dw.gear.json';
import P2BISOffensiveTierlessDWGear from './gear_sets/p2_bis_offensive_tierless_dw.gear.json';

// Preset options for this spec.
// Eventually we will import these values for the raid sim too, so its good to
// keep them in a separate file.

export const PREBIS_GEAR_PRESET = PresetUtils.makePresetGear('Pre-BIS (Balanced)', PreBISGear);
export const P1_BIS_DW_GEAR_PRESET = PresetUtils.makePresetGear('P1 - BIS (Balanced)', P1BISDWGear);
export const P2_BIS_DW_GEAR_PRESET = PresetUtils.makePresetGear('P2 - BIS (Balanced)', P2BISDWGear);
export const P2_BIS_OFFENSIVE_DW_GEAR_PRESET = PresetUtils.makePresetGear('P2 - BIS (Offensive - 2PC)', P2BISOffensiveDWGear);
export const P2_BIS_OFFENSIVE_TIERLESS_DW_GEAR_PRESET = PresetUtils.makePresetGear('P2 - BIS (Offensive - No Tier)', P2BISOffensiveTierlessDWGear);
export const P3_BIS_DW_GEAR_PRESET = PresetUtils.makePresetGear('P3 - BIS (Balanced)', P3BISDWGear);
export const P3_BIS_OFFENSIVE_DW_GEAR_PRESET = PresetUtils.makePresetGear('P3 - BIS (Offensive)', P3OffensiveDWGear);

export const ROTATION_PRESET = PresetUtils.makePresetAPLRotation('Generic', DefaultApl);
export const ROTATION_GARAJAL_PRESET = PresetUtils.makePresetAPLRotation("Gara'jal", GarajalApl);
export const ROTATION_OFFENSIVE_PRESET = PresetUtils.makePresetAPLRotation('Offensive', OffensiveApl);
export const ROTATION_SHA_PRESET = PresetUtils.makePresetAPLRotation('Sha of Fear', ShaApl);
export const ROTATION_HORRIDON_PRESET = PresetUtils.makePresetAPLRotation('Horridon', HorridonApl);

// Preset options for EP weights
export const P2_BALANCED_EP_PRESET = PresetUtils.makePresetEpWeights(
	'P2 - Balanced',
	Stats.fromMap(
		{
			[Stat.StatAgility]: 1,
			[Stat.StatStamina]: 0.81,
			[Stat.StatHitRating]: 1.28,
			[Stat.StatCritRating]: 0.67,
			[Stat.StatHasteRating]: 0.42,
			[Stat.StatExpertiseRating]: 0.96,
			[Stat.StatDodgeRating]: 0.2,
			[Stat.StatParryRating]: 0.23,
			[Stat.StatMasteryRating]: 0.65,
			[Stat.StatAttackPower]: 0.24,
			[Stat.StatArmor]: 0.41,
			[Stat.StatBonusArmor]: 0.41,
		},
		{
			[PseudoStat.PseudoStatMainHandDps]: 1.5,
			[PseudoStat.PseudoStatOffHandDps]: 0.74,
		},
	),
);

export const P2_OFFENSIVE_EP_PRESET = PresetUtils.makePresetEpWeights(
	'P2 - Offensive',
	Stats.fromMap(
		{
			[Stat.StatAgility]: 1,
			[Stat.StatStamina]: 0.35,
			[Stat.StatHitRating]: 1.66,
			[Stat.StatCritRating]: 0.68,
			[Stat.StatHasteRating]: 0.4,
			[Stat.StatExpertiseRating]: 1.24,
			[Stat.StatDodgeRating]: 0.09,
			[Stat.StatParryRating]: 0.11,
			[Stat.StatMasteryRating]: 0.24,
			[Stat.StatAttackPower]: 0.3,
			[Stat.StatArmor]: 0.17,
			[Stat.StatBonusArmor]: 0.17,
		},
		{
			[PseudoStat.PseudoStatMainHandDps]: 1.96,
			[PseudoStat.PseudoStatOffHandDps]: 0.97,
		},
	),
);

export const P3_BALANCED_EP_PRESET = PresetUtils.makePresetEpWeights(
	'P3 - Balanced',
	Stats.fromMap(
		{
			[Stat.StatAgility]: 1,
			[Stat.StatStamina]: 0.53,
			[Stat.StatHitRating]: 1.31,
			[Stat.StatCritRating]: 0.71,
			[Stat.StatHasteRating]: 0.61,
			[Stat.StatExpertiseRating]: 0.95,
			[Stat.StatDodgeRating]: 0.32,
			[Stat.StatParryRating]: 0.41,
			[Stat.StatMasteryRating]: 0.69,
			[Stat.StatAttackPower]: 0.18,
			[Stat.StatArmor]: 0.4,
			[Stat.StatBonusArmor]: 0.4,
		},
		{
			[PseudoStat.PseudoStatMainHandDps]: 1.79,
			[PseudoStat.PseudoStatOffHandDps]: 1.38,
		},
	),
);

export const P3_OFFENSIVE_EP_PRESET = PresetUtils.makePresetEpWeights(
	'P3 - Offensive',
	Stats.fromMap(
		{
			[Stat.StatAgility]: 1,
			[Stat.StatStamina]: 0.35,
			[Stat.StatHitRating]: 1.56,
			[Stat.StatCritRating]: 0.8,
			[Stat.StatHasteRating]: 0.65,
			[Stat.StatExpertiseRating]: 1.1,
			[Stat.StatDodgeRating]: 0.21,
			[Stat.StatParryRating]: 0.3,
			[Stat.StatMasteryRating]: 0.42,
			[Stat.StatAttackPower]: 0.22,
			[Stat.StatArmor]: 0.26,
			[Stat.StatBonusArmor]: 0.26,
		},
		{
			[PseudoStat.PseudoStatMainHandDps]: 1.78,
			[PseudoStat.PseudoStatOffHandDps]: 1.24,
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
	conjuredId: 5512, // Healthstone
});

export const OffensiveConsumables = ConsumesSpec.create({
	...DefaultConsumables,
	prepotId: 76089, // Virmen's Bite
	potId: 76089, // Virmen's Bite
});

export const OtherDefaults = {
	profession1: Profession.Engineering,
	profession2: Profession.Blacksmithing,
	distanceFromTarget: 5,
	iterationCount: 25000,
};

export const PRESET_BUILD_GARAJAL = PresetUtils.makePresetBuildFromJSON("Gara'jal", Spec.SpecBrewmasterMonk, GarajalBuild);
export const PRESET_BUILD_SHA = PresetUtils.makePresetBuildFromJSON('Sha of Fear P2', Spec.SpecBrewmasterMonk, ShaBuild);
export const PRESET_BUILD_HORRIDON = PresetUtils.makePresetBuildFromJSON('Horridon P2', Spec.SpecBrewmasterMonk, HorridonBuild);
