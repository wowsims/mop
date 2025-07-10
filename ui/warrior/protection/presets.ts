import { Encounter } from '../../core/encounter';
import * as PresetUtils from '../../core/preset_utils.js';
import { ConsumesSpec, Glyphs, Profession, PseudoStat, Spec, Stat } from '../../core/proto/common.js';
import { SavedTalents } from '../../core/proto/ui.js';
import { ProtectionWarrior_Options as ProtectionWarriorOptions, WarriorMajorGlyph } from '../../core/proto/warrior.js';
import { Stats } from '../../core/proto_utils/stats';
import DefensiveApl from './apls/default.apl.json';
import DefautlApl from './apls/garajal.apl.json';
import DefaultBuild from './builds/garajal_default.build.json';
import P1BISGear from './gear_sets/p1_bis.gear.json';
import P1BISItemSwapGear from './gear_sets/p1_bis_item_swap.gear.json';
import PreraidBISGear from './gear_sets/preraid.gear.json';

// Preset options for this spec.
// Eventually we will import these values for the raid sim too, so its good to
// keep them in a separate file.

export const PRERAID_BALANCED_PRESET = PresetUtils.makePresetGear('Pre-raid', PreraidBISGear);
export const P1_BALANCED_PRESET = PresetUtils.makePresetGear('P1 - BIS', P1BISGear);

export const P1_ITEM_SWAP = PresetUtils.makePresetItemSwapGear('P1 - Item Swap', P1BISItemSwapGear);

export const ROTATION_DEFENSIVE = PresetUtils.makePresetAPLRotation('Defensive', DefensiveApl);
export const ROTATION_DEFAULT = PresetUtils.makePresetAPLRotation("Gara'jal", DefautlApl);

// Preset options for EP weights
export const P1_EP_PRESET = PresetUtils.makePresetEpWeights(
	'Default',
	Stats.fromMap(
		{
			[Stat.StatArmor]: 2.155,
			[Stat.StatBonusArmor]: 2.155,
			[Stat.StatStamina]: 12.442,
			[Stat.StatStrength]: 1.4,
			[Stat.StatAgility]: 0.26,
			[Stat.StatAttackPower]: 0.196,
			[Stat.StatExpertiseRating]: 0.863,
			[Stat.StatHitRating]: 0.736,
			[Stat.StatCritRating]: 0.336,
			[Stat.StatHasteRating]: 0.048,
			[Stat.StatDodgeRating]: 4.801,
			[Stat.StatParryRating]: 4.801,
			[Stat.StatMasteryRating]: 7.415,
		},
		{
			[PseudoStat.PseudoStatMainHandDps]: 6.081,
		},
	),
);

// Default talents. Uses the wowhead calculator format, make the talents on
// https://wowhead.com/mop-classic/talent-calc and copy the numbers in the url.
export const StandardTalents = {
	name: 'Standard',
	data: SavedTalents.create({
		talentsString: '233232',
		glyphs: Glyphs.create({
			major1: WarriorMajorGlyph.GlyphOfIncite,
			major2: WarriorMajorGlyph.GlyphOfHeavyRepercussions,
			major3: WarriorMajorGlyph.GlyphOfHoldTheLine,
		}),
	}),
};

export const DefaultOptions = ProtectionWarriorOptions.create({
	classOptions: {},
});

export const DefaultConsumables = ConsumesSpec.create({
	flaskId: 76087, // Flask of the Earth
	foodId: 81411, // Peach Pie
	prepotId: 76090, // Potion of the Mountains
	potId: 76090, // Potion of the Mountains
});

export const OtherDefaults = {
	profession1: Profession.Tailoring,
	profession2: Profession.Blacksmithing,
	distanceFromTarget: 15,
};

export const PRESET_BUILD_DEFAULT = PresetUtils.makePresetBuildFromJSON("Gara'jal", Spec.SpecProtectionWarrior, DefaultBuild);
export const PRESET_BUILD_DEFENSIVE = PresetUtils.makePresetBuild('Defensive', {
	talents: StandardTalents,
	rotation: ROTATION_DEFENSIVE,
	itemSwap: P1_ITEM_SWAP,
	encounter: PresetUtils.makePresetEncounter('Defensive', Encounter.defaultEncounterProto()),
});
