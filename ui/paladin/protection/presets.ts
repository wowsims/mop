import * as PresetUtils from '../../core/preset_utils.js';
import { ConsumesSpec, Glyphs, Profession, PseudoStat, Spec, Stat } from '../../core/proto/common.js';
import { PaladinMajorGlyph, PaladinMinorGlyph, PaladinSeal, ProtectionPaladin_Options as ProtectionPaladinOptions } from '../../core/proto/paladin.js';
import { SavedTalents } from '../../core/proto/ui.js';
import { Stats } from '../../core/proto_utils/stats';
import ShaApl from './apls/sha.apl.json';
import HorridonApl from './apls/horridon.apl.json';
import IronJuggernautApl from './apls/iron_juggernaut.apl.json';
import P2_Balanced_Gear from './gear_sets/p2_balanced.gear.json';
import P2_Offensive_Gear from './gear_sets/p2_offensive.gear.json';
import P4_Balanced_Gear from './gear_sets/p4_balanced.gear.json';
import P4_Offensive_Gear from './gear_sets/p4_offensive.gear.json';
import P5_Prog_Gear from './gear_sets/p5_prog.gear.json';
import P5_Balanced_Gear from './gear_sets/p5_balanced.gear.json';
import P5_Offensive_Gear from './gear_sets/p5_offensive.gear.json';
import DefaultBuild from './builds/sha_default.build.json';
import ShaBuild from './builds/sha_encounter_only.build.json';
import HorridonBuild from './builds/horridon_encounter_only.build.json';
import IronJuggernautBuild from './builds/iron_juggernaut_encounter_only.build.json';

// Preset options for this spec.
// Eventually we will import these values for the raid sim too, so its good to
// keep them in a separate file.

export const P2_BALANCED_GEAR_PRESET = PresetUtils.makePresetGear('P2 - BIS (Balanced)', P2_Balanced_Gear);
export const P2_OFFENSIVE_GEAR_PRESET = PresetUtils.makePresetGear('P2 - BIS (Offensive)', P2_Offensive_Gear);
export const P3_4_BALANCED_GEAR_PRESET = PresetUtils.makePresetGear('P3 & P4 - BIS (Balanced)', P4_Balanced_Gear);
export const P3_4_OFFENSIVE_GEAR_PRESET = PresetUtils.makePresetGear('P3 & P4 - BIS (Offensive)', P4_Offensive_Gear);
export const P5_PROG_GEAR_PRESET = PresetUtils.makePresetGear('P5 - Prog (Balanced)', P5_Prog_Gear);
export const P5_BALANCED_GEAR_PRESET = PresetUtils.makePresetGear('P5 - BIS (WIP - Balanced)', P5_Balanced_Gear);
export const P5_OFFENSIVE_GEAR_PRESET = PresetUtils.makePresetGear('P5 - BIS (WIP - Offensive)', P5_Offensive_Gear);

export const APL_SHA_PRESET = PresetUtils.makePresetAPLRotation('Sha of Fear', ShaApl);
export const APL_HORRIDON_PRESET = PresetUtils.makePresetAPLRotation('Horridon', HorridonApl);
export const APL_IRON_JUGGERNAUT_PRESET = PresetUtils.makePresetAPLRotation('Iron Juggernaut', IronJuggernautApl);

// Preset options for EP weights
export const P2_BALANCED_EP_PRESET = PresetUtils.makePresetEpWeights(
	'P2 - Balanced',
	Stats.fromMap(
		{
			[Stat.StatStrength]: 1.0,
			[Stat.StatStamina]: 0.92,
			[Stat.StatHitRating]: 1.14,
			[Stat.StatCritRating]: 0.46,
			[Stat.StatHasteRating]: 0.72,
			[Stat.StatExpertiseRating]: 0.94,
			[Stat.StatDodgeRating]: 0.41,
			[Stat.StatParryRating]: 0.37,
			[Stat.StatMasteryRating]: 0.67,
			[Stat.StatAttackPower]: 0.3,
			[Stat.StatArmor]: 0.5,
			[Stat.StatBonusArmor]: 0.5,
		},
		{
			[PseudoStat.PseudoStatMainHandDps]: 0.49,
		},
	),
);

export const P2_OFFENSIVE_EP_PRESET = PresetUtils.makePresetEpWeights(
	'P2 - Offensive',
	Stats.fromMap(
		{
			[Stat.StatStrength]: 1.0,
			[Stat.StatStamina]: 0.67,
			[Stat.StatHitRating]: 1.21,
			[Stat.StatCritRating]: 0.59,
			[Stat.StatHasteRating]: 0.61,
			[Stat.StatExpertiseRating]: 1.07,
			[Stat.StatDodgeRating]: 0.31,
			[Stat.StatParryRating]: 0.28,
			[Stat.StatMasteryRating]: 0.49,
			[Stat.StatAttackPower]: 0.35,
			[Stat.StatArmor]: 0.36,
			[Stat.StatBonusArmor]: 0.36,
		},
		{
			[PseudoStat.PseudoStatMainHandDps]: 0.62,
		},
	),
);

export const P3_4_BALANCED_EP_PRESET = PresetUtils.makePresetEpWeights(
	'P3 & P4 - Balanced',
	Stats.fromMap(
		{
			[Stat.StatStrength]: 1.0,
			[Stat.StatStamina]: 0.75,
			[Stat.StatHitRating]: 1.95,
			[Stat.StatCritRating]: 1.07,
			[Stat.StatHasteRating]: 1.21,
			[Stat.StatExpertiseRating]: 1.57,
			[Stat.StatDodgeRating]: 0.42,
			[Stat.StatParryRating]: 0.4,
			[Stat.StatMasteryRating]: 1.01,
			[Stat.StatAttackPower]: 0.29,
			[Stat.StatArmor]: 0.41,
			[Stat.StatBonusArmor]: 0.41,
		},
		{
			[PseudoStat.PseudoStatMainHandDps]: 0.41,
		},
	),
);

export const P3_4_OFFENSIVE_EP_PRESET = PresetUtils.makePresetEpWeights(
	'P3 & P4 - Offensive',
	Stats.fromMap(
		{
			[Stat.StatStrength]: 1.0,
			[Stat.StatStamina]: 0.61,
			[Stat.StatHitRating]: 2.16,
			[Stat.StatCritRating]: 1.23,
			[Stat.StatHasteRating]: 1.24,
			[Stat.StatExpertiseRating]: 1.83,
			[Stat.StatDodgeRating]: 0.35,
			[Stat.StatParryRating]: 0.34,
			[Stat.StatMasteryRating]: 0.83,
			[Stat.StatAttackPower]: 0.32,
			[Stat.StatArmor]: 0.34,
			[Stat.StatBonusArmor]: 0.34,
		},
		{
			[PseudoStat.PseudoStatMainHandDps]: 0.48,
		},
	),
);

export const P5_BALANCED_EP_PRESET = PresetUtils.makePresetEpWeights(
	'P5 - Balanced',
	Stats.fromMap(
		{
			[Stat.StatStrength]: 1.00,
			[Stat.StatStamina]: 1.32,
			[Stat.StatHitRating]: 3.09,
			[Stat.StatCritRating]: 1.17,
			[Stat.StatHasteRating]: 1.32,
			[Stat.StatExpertiseRating]: 2.48,
			[Stat.StatDodgeRating]: 0.53,
			[Stat.StatParryRating]: 0.47,
			[Stat.StatMasteryRating]: 1.16,
			[Stat.StatAttackPower]: 0.26,
			[Stat.StatArmor]: 0.39,
			[Stat.StatBonusArmor]: 0.39,
		},
		{
			[PseudoStat.PseudoStatMainHandDps]: 0.32,
		},
	),
);

export const P5_OFFENSIVE_EP_PRESET = PresetUtils.makePresetEpWeights(
	'P5 - Offensive',
	Stats.fromMap(
		{
			[Stat.StatStrength]: 1.0,
			[Stat.StatStamina]: 0.35,
			[Stat.StatHitRating]: 4.46,
			[Stat.StatCritRating]: 2.14,
			[Stat.StatHasteRating]: 2.15,
			[Stat.StatExpertiseRating]: 3.72,
			[Stat.StatDodgeRating]: 0.2,
			[Stat.StatParryRating]: 0.2,
			[Stat.StatMasteryRating]: 0.35,
			[Stat.StatAttackPower]: 0.38,
			[Stat.StatArmor]: 0.1,
			[Stat.StatBonusArmor]: 0.1,
		},
		{
			[PseudoStat.PseudoStatMainHandDps]: 0.55,
		},
	),
);

// Default talents. Uses the wowhead calculator format, make the talents on
// https://wowhead.com/mop-classic/talent-calc and copy the numbers in the url.

export const DefaultTalents = {
	name: 'Default',
	data: SavedTalents.create({
		talentsString: '313213',
		glyphs: Glyphs.create({
			major1: PaladinMajorGlyph.GlyphOfFocusedShield,
			major2: PaladinMajorGlyph.GlyphOfTheAlabasterShield,
			major3: PaladinMajorGlyph.GlyphOfDivineProtection,

			minor1: PaladinMinorGlyph.GlyphOfFocusedWrath,
		}),
	}),
};

export const P4_BALANCED_BUILD_PRESET = PresetUtils.makePresetBuild('P4 Gear/EPs/Talents (Horridon)', {
	gear: P3_4_BALANCED_GEAR_PRESET,
	epWeights: P3_4_BALANCED_EP_PRESET,
	talents: DefaultTalents,
});
export const PRESET_BUILD_DEFAULT = PresetUtils.makePresetBuildFromJSON('Default', Spec.SpecProtectionPaladin, DefaultBuild);
export const PRESET_BUILD_SHA = PresetUtils.makePresetBuildFromJSON('Sha of Fear P2', Spec.SpecProtectionPaladin, ShaBuild);
export const PRESET_BUILD_HORRIDON = PresetUtils.makePresetBuildFromJSON('Horridon P2', Spec.SpecProtectionPaladin, HorridonBuild);
export const PRESET_BUILD_IRON_JUGGERNAUT = PresetUtils.makePresetBuildFromJSON('Iron Juggernaut P1', Spec.SpecProtectionPaladin, IronJuggernautBuild);

export const DefaultOptions = ProtectionPaladinOptions.create({
	classOptions: {
		seal: PaladinSeal.Insight,
	},
});

export const DefaultConsumables = ConsumesSpec.create({
	flaskId: 76087, // Flask of the Earth
	foodId: 74656, // Chun Tian Spring Rolls
	potId: 76095, // Potion of Mogu Power
	prepotId: 76095, // Potion of Mogu Power
});

export const OtherDefaults = {
	profession1: Profession.Blacksmithing,
	profession2: Profession.Engineering,
	distanceFromTarget: 5,
	iterationCount: 25000,
};
