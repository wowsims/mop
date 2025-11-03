import * as PresetUtils from '../../core/preset_utils.js';
import { ConsumesSpec, Glyphs, Profession, PseudoStat, Spec, Stat } from '../../core/proto/common.js';
import { SavedTalents } from '../../core/proto/ui.js';
import { ProtectionWarrior_Options as ProtectionWarriorOptions, WarriorMajorGlyph } from '../../core/proto/warrior.js';
import { Stats } from '../../core/proto_utils/stats';
import GenericApl from './apls/default.apl.json';
import GarajalApl from './apls/garajal.apl.json';
import ShaApl from './apls/sha.apl.json';
import GarajalBuild from './builds/garajal_default.build.json';
import ShaBuild from './builds/sha_default.build.json';
import P1BISGear from './gear_sets/p1_bis.gear.json';
import P2BISGear from './gear_sets/p2_bis.gear.json';
import P3BISGear from './gear_sets/p3_bis.gear.json';
import P3BISOffensiveGear from './gear_sets/p3_bis_offensive.gear.json';
import P1BISItemSwapGear from './gear_sets/p1_bis_item_swap.gear.json';
import P2BISItemSwapGear from './gear_sets/p2_bis_item_swap.gear.json';
import P2BISOffensiveGear from './gear_sets/p2_bis_offensive.gear.json';
import PreRaidItemSwapGear from './gear_sets/p1_preraid_item_swap.gear.json';
import PreraidBISGear from './gear_sets/preraid.gear.json';

// Preset options for this spec.
// Eventually we will import these values for the raid sim too, so its good to
// keep them in a separate file.

export const PRERAID_BALANCED_PRESET = PresetUtils.makePresetGear('Pre-raid', PreraidBISGear);
export const P1_BALANCED_PRESET = PresetUtils.makePresetGear('P1 - BIS', P1BISGear);
export const P2_BALANCED_PRESET = PresetUtils.makePresetGear('P2 - BIS', P2BISGear);
export const P2_OFFENSIVE_PRESET = PresetUtils.makePresetGear('P2 - BIS (Offensive)', P2BISOffensiveGear);
export const P3_BALANCED_PRESET = PresetUtils.makePresetGear('P3 - BIS (TBD)', P3BISGear);
export const P3_OFFENSIVE_PRESET = PresetUtils.makePresetGear('P3 - BIS (TBD - Offensive)', P3BISOffensiveGear);

export const PRERAID_ITEM_SWAP = PresetUtils.makePresetItemSwapGear('Pre-raid - Item Swap', PreRaidItemSwapGear);
export const P1_ITEM_SWAP = PresetUtils.makePresetItemSwapGear('P1 - Item Swap', P1BISItemSwapGear);
export const P2_ITEM_SWAP = PresetUtils.makePresetItemSwapGear('P2 - Item Swap', P2BISItemSwapGear);

export const ROTATION_GENERIC = PresetUtils.makePresetAPLRotation('Generic', GenericApl);
export const ROTATION_GARAJAL = PresetUtils.makePresetAPLRotation("Gara'jal", GarajalApl);
export const ROTATION_SHA = PresetUtils.makePresetAPLRotation('Sha of Fear', ShaApl);

// Preset options for EP weights
export const P2_EP_PRESET = PresetUtils.makePresetEpWeights(
	'P2 - Default',
	Stats.fromMap(
		{
			[Stat.StatStrength]: 1,
			[Stat.StatStamina]: 1.07,
			[Stat.StatHitRating]: 1.78,
			[Stat.StatCritRating]: 0.7,
			[Stat.StatHasteRating]: 0.11,
			[Stat.StatExpertiseRating]: 1.77,
			[Stat.StatDodgeRating]: 0.82,
			[Stat.StatParryRating]: 0.82,
			[Stat.StatMasteryRating]: 0.19,
			[Stat.StatAttackPower]: 0.33,
			[Stat.StatArmor]: 0.55,
			[Stat.StatBonusArmor]: 0.55,
		},
		{
			[PseudoStat.PseudoStatMainHandDps]: 0.96,
		},
	),
);

export const P2_OFFENSIVE_EP_PRESET = PresetUtils.makePresetEpWeights(
	'P2 - Offensive',
	Stats.fromMap(
		{
			[Stat.StatStrength]: 1,
			[Stat.StatStamina]: 0.36,
			[Stat.StatHitRating]: 1.62,
			[Stat.StatCritRating]: 0.82,
			[Stat.StatHasteRating]: 0.18,
			[Stat.StatExpertiseRating]: 1.61,
			[Stat.StatDodgeRating]: 0.6,
			[Stat.StatParryRating]: 0.63,
			[Stat.StatMasteryRating]: 0.07,
			[Stat.StatAttackPower]: 0.4,
			[Stat.StatArmor]: 0.18,
			[Stat.StatBonusArmor]: 0.18,
		},
		{
			[PseudoStat.PseudoStatMainHandDps]: 1.37,
		},
	),
);

// export const P3_EP_PRESET = PresetUtils.makePresetEpWeights(
// 	'P3 - Balanced',
// 	Stats.fromMap(
// 		{
// 			[Stat.StatStrength]: 1,
// 			[Stat.StatStamina]: 0.66,
// 			[Stat.StatHitRating]: 3.66,
// 			[Stat.StatCritRating]: 1.07,
// 			[Stat.StatHasteRating]: 0.04,
// 			[Stat.StatExpertiseRating]: 3.57,
// 			[Stat.StatDodgeRating]: 1.42,
// 			[Stat.StatParryRating]: 1.43,
// 			[Stat.StatMasteryRating]: 0.29,
// 			[Stat.StatAttackPower]: 0.32,
// 			[Stat.StatArmor]: 0.55,
// 			[Stat.StatBonusArmor]: 0.55,
// 		},
// 		{
// 			[PseudoStat.PseudoStatMainHandDps]: 0.57,
// 		},
// 	),
// );

// export const P3_OFFENSIVE_EP_PRESET = PresetUtils.makePresetEpWeights(
// 	'P3 - Offensive',
// 	Stats.fromMap(
// 		{
// 			[Stat.StatStrength]: 1,
// 			[Stat.StatStamina]: 0.37,
// 			[Stat.StatHitRating]: 3.56,
// 			[Stat.StatCritRating]: 1.41,
// 			[Stat.StatHasteRating]: 0.11,
// 			[Stat.StatExpertiseRating]: 3.46,
// 			[Stat.StatDodgeRating]: 1.38,
// 			[Stat.StatParryRating]: 1.39,
// 			[Stat.StatMasteryRating]: 0.2,
// 			[Stat.StatAttackPower]: 0.34,
// 			[Stat.StatArmor]: 0.38,
// 			[Stat.StatBonusArmor]: 0.38,
// 		},
// 		{
// 			[PseudoStat.PseudoStatMainHandDps]: 0.78,
// 		},
// 	),
// );

// Default talents. Uses the wowhead calculator format, make the talents on
// https://wowhead.com/mop-classic/talent-calc and copy the numbers in the url.
export const StandardTalents = {
	name: 'Standard',
	data: SavedTalents.create({
		talentsString: '213332',
		glyphs: Glyphs.create({
			major1: WarriorMajorGlyph.GlyphOfHeavyRepercussions,
			major2: WarriorMajorGlyph.GlyphOfIncite,
			major3: WarriorMajorGlyph.GlyphOfHoldTheLine,
		}),
	}),
};

export const DefaultOptions = ProtectionWarriorOptions.create({
	classOptions: {},
});

export const DefaultConsumables = ConsumesSpec.create({
	flaskId: 76087, // Flask of the Earth
	foodId: 74656, // Chun Tian Spring Rolls
	prepotId: 76090, // Potion of the Mountains
	potId: 76090, // Potion of the Mountains
	conjuredId: 5512, // Healthstone
});

export const OtherDefaults = {
	profession1: Profession.Engineering,
	profession2: Profession.Blacksmithing,
	distanceFromTarget: 15,
};

export const PRESET_BUILD_GARAJAL = PresetUtils.makePresetBuildFromJSON("Pre-Raid - Gara'jal", Spec.SpecProtectionWarrior, GarajalBuild);
export const PRESET_BUILD_SHA = PresetUtils.makePresetBuildFromJSON('P2 - Sha of Fear', Spec.SpecProtectionWarrior, ShaBuild);

// const TEMP_P3_STATIC_ENCOUNTER = PresetUtils.makePresetEncounter('P3 (TBD)', {
// 	...Encounter.defaultEncounterProto(),
// 	targets: [
// 		{
// 			...Encounter.defaultTargetProto(),
// 			minBaseDamage: 950000,
// 		},
// 	],
// });

// export const PRESET_BUILD_P3_BIS_OFFENSIVE = PresetUtils.makePresetBuild('P3 - BIS - Offensive (TBD)', {
// 	gear: P3_OFFENSIVE_PRESET,
// 	talents: StandardTalents,
// 	rotation: ROTATION_GENERIC,
// 	settings: {
// 		name: 'P3 - BIS',
// 		consumables: ConsumesSpec.create({
// 			...DefaultConsumables,
// 			flaskId: undefined,
// 			battleElixirId: 76076, // Mad Hozen Elixir
// 			guardianElixirId: 76081, // Elixir of Mirrors
// 			foodId: 74646, // Black Pepper Rib and Shrimp
// 			prepotId: 76095, // Potion of Mogu Power
// 			potId: 76095, // Potion of Mogu Power
// 			conjuredId: 5512, // Healthstone
// 		}),
// 	},
// 	encounter: TEMP_P3_STATIC_ENCOUNTER,
// });

// export const PRESET_BUILD_P3_BIS = PresetUtils.makePresetBuild('P3 - BIS (TBD)', {
// 	gear: P3_BALANCED_PRESET,
// 	talents: StandardTalents,
// 	rotation: ROTATION_GENERIC,
// 	settings: {
// 		name: 'P3 - BIS',
// 		consumables: ConsumesSpec.create({
// 			...DefaultConsumables,
// 			flaskId: undefined,
// 			battleElixirId: 76076, // Mad Hozen Elixir
// 			guardianElixirId: 76081, // Elixir of Mirrors
// 		}),
// 	},
// 	encounter: TEMP_P3_STATIC_ENCOUNTER,
// });
