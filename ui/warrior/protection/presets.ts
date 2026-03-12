import * as PresetUtils from '../../core/preset_utils.js';
import { ConsumesSpec, Glyphs, Profession, PseudoStat, Spec, Stat } from '../../core/proto/common.js';
import { SavedTalents } from '../../core/proto/ui.js';
import { ProtectionWarrior_Options as ProtectionWarriorOptions, WarriorMajorGlyph } from '../../core/proto/warrior.js';
import { Stats } from '../../core/proto_utils/stats';
import GenericApl from './apls/default.apl.json';
import GarajalApl from './apls/garajal.apl.json';
import ShaApl from './apls/sha.apl.json';
import HorridonApl from './apls/horridon.apl.json';
import GarajalBuild from './builds/garajal_encounter_only.build.json';
import ShaBuild from './builds/sha_encounter_only.build.json';
import HorridonBuild from './builds/horridon_encounter_only.build.json';
import P2BISGear from './gear_sets/p2_bis.gear.json';
import P3ProgGear from './gear_sets/p3_prog.gear.json';
import P3BISGear from './gear_sets/p3_bis.gear.json';
import P3BISOffensiveGear from './gear_sets/p3_bis_offensive.gear.json';
import P2BISItemSwapGear from './gear_sets/p2_bis_item_swap.gear.json';
import P2BISOffensiveGear from './gear_sets/p2_bis_offensive.gear.json';
import PreRaidItemSwapGear from './gear_sets/p1_preraid_item_swap.gear.json';
import PreraidBISGear from './gear_sets/preraid.gear.json';

// Preset options for this spec.
// Eventually we will import these values for the raid sim too, so its good to
// keep them in a separate file.

export const PRERAID_BALANCED_PRESET = PresetUtils.makePresetGear('Pre-BIS', PreraidBISGear);
export const P2_BALANCED_PRESET = PresetUtils.makePresetGear('P2 - BIS', P2BISGear);
export const P2_OFFENSIVE_PRESET = PresetUtils.makePresetGear('P2 - BIS (Offensive)', P2BISOffensiveGear);
export const P3_PROG_PRESET = PresetUtils.makePresetGear('Tentative - P3 - Prog (Balanced)', P3ProgGear);
export const P3_BALANCED_PRESET = PresetUtils.makePresetGear('Tentative - P3 - BIS (Balanced)', P3BISGear);
export const P3_OFFENSIVE_PRESET = PresetUtils.makePresetGear('Tentative - P3 - BIS (Offensive)', P3BISOffensiveGear);

export const PRERAID_ITEM_SWAP = PresetUtils.makePresetItemSwapGear('Pre-raid - Item Swap', PreRaidItemSwapGear);
export const P2_ITEM_SWAP = PresetUtils.makePresetItemSwapGear('P2 - Item Swap', P2BISItemSwapGear);

export const ROTATION_GENERIC = PresetUtils.makePresetAPLRotation('Generic', GenericApl);
export const ROTATION_GARAJAL = PresetUtils.makePresetAPLRotation("Gara'jal", GarajalApl);
export const ROTATION_SHA = PresetUtils.makePresetAPLRotation('Sha of Fear', ShaApl);
export const ROTATION_HORRIDON = PresetUtils.makePresetAPLRotation('Horridon', HorridonApl);

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

export const P3_EP_PRESET = PresetUtils.makePresetEpWeights(
	'P3 - Balanced',
	Stats.fromMap(
		{
			[Stat.StatStrength]: 1.0,
			[Stat.StatStamina]: 0.75,
			[Stat.StatHitRating]: 2.19,
			[Stat.StatCritRating]: 0.82,
			[Stat.StatHasteRating]: 0.17,
			[Stat.StatExpertiseRating]: 2.23,
			[Stat.StatDodgeRating]: 1.09,
			[Stat.StatParryRating]: 1.15,
			[Stat.StatMasteryRating]: 0.16,
			[Stat.StatAttackPower]: 0.28,
			[Stat.StatArmor]: 0.62,
			[Stat.StatBonusArmor]: 0.62,
		},
		{
			[PseudoStat.PseudoStatMainHandDps]: 0.68,
		},
	),
);

export const P3_OFFENSIVE_EP_PRESET = PresetUtils.makePresetEpWeights(
	'P3 - Offensive',
	Stats.fromMap(
		{
			[Stat.StatStrength]: 1.00,
			[Stat.StatStamina]: 0.31,
			[Stat.StatHitRating]: 2.40,
			[Stat.StatCritRating]: 1.13,
			[Stat.StatHasteRating]: 0.28,
			[Stat.StatExpertiseRating]: 2.44,
			[Stat.StatDodgeRating]: 1.00,
			[Stat.StatParryRating]: 1.11,
			[Stat.StatMasteryRating]: 0.07,
			[Stat.StatAttackPower]: 0.34,
			[Stat.StatArmor]: 0.24,
			[Stat.StatBonusArmor]: 0.24,
		},
		{
			[PseudoStat.PseudoStatMainHandDps]: 0.91,
		},
	),
);

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

export const PRESET_BUILD_GARAJAL = PresetUtils.makePresetBuildFromJSON("Gara'jal", Spec.SpecProtectionWarrior, GarajalBuild);
export const PRESET_BUILD_SHA = PresetUtils.makePresetBuildFromJSON('Sha of Fear P2', Spec.SpecProtectionWarrior, ShaBuild);
export const PRESET_BUILD_HORRIDON = PresetUtils.makePresetBuildFromJSON('Horridon P2', Spec.SpecProtectionWarrior, HorridonBuild);

// const TEMP_P3_STATIC_ENCOUNTER = PresetUtils.makePresetEncounter('P3', {
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
