import * as PresetUtils from '../../core/preset_utils';
import { ConsumesSpec, Glyphs, Profession, PseudoStat, Race, Stat } from '../../core/proto/common';
import { SavedTalents } from '../../core/proto/ui';
import { ArmsWarrior_Options as WarriorOptions, WarriorMajorGlyph } from '../../core/proto/warrior';
import { Stats } from '../../core/proto_utils/stats';
import ArmsApl from './apls/arms.apl.json';
import P2ArmsBisGear from './gear_sets/p2_arms_bis.gear.json';
import P3ArmsBisGear from './gear_sets/p3_arms_bis.gear.json';
import PreBisGear from './gear_sets/prebis.gear.json';

// Preset options for this spec.
// Eventually we will import these values for the raid sim too, so its good to
// keep them in a separate file.

export const PREBIS_PRESET = PresetUtils.makePresetGear('Pre-BIS', PreBisGear);
export const P2_ARMS_BIS_PRESET = PresetUtils.makePresetGear('P2 - BIS', P2ArmsBisGear);
export const P3_ARMS_BIS_PRESET = PresetUtils.makePresetGear('P3 - BIS', P3ArmsBisGear);

export const ROTATION_ARMS = PresetUtils.makePresetAPLRotation('Default', ArmsApl);

// Preset options for EP weights
export const P1_EP_PRESET = PresetUtils.makePresetEpWeights(
	'Item Level < 500',
	Stats.fromMap(
		{
			[Stat.StatStrength]: 1,
			[Stat.StatAttackPower]: 0.45,
			[Stat.StatExpertiseRating]: 1.2,
			[Stat.StatHitRating]: 1.4,
			[Stat.StatCritRating]: 0.59,
			[Stat.StatHasteRating]: 0.32,
			[Stat.StatMasteryRating]: 0.39,
		},
		{
			[PseudoStat.PseudoStatMainHandDps]: 3.71,
			[PseudoStat.PseudoStatOffHandDps]: 0,
		},
	),
);

export const P2_EP_PRESET = PresetUtils.makePresetEpWeights(
	'Item Level >= 500',
	Stats.fromMap(
		{
			[Stat.StatStrength]: 1,
			[Stat.StatAttackPower]: 0.45,
			[Stat.StatExpertiseRating]: 1.39,
			[Stat.StatHitRating]: 1.88,
			[Stat.StatCritRating]: 0.65,
			[Stat.StatHasteRating]: 0.3,
			[Stat.StatMasteryRating]: 0.49,
		},
		{
			[PseudoStat.PseudoStatMainHandDps]: 3.54,
			[PseudoStat.PseudoStatOffHandDps]: 0,
		},
	),
);

// Default talents. Uses the wowhead calculator format, make the talents on
// https://wowhead.com/wotlk/talent-calc and copy the numbers in the url.

export const ArmsTalents = {
	name: 'Default',
	data: SavedTalents.create({
		talentsString: '113132',
		glyphs: Glyphs.create({
			major1: WarriorMajorGlyph.GlyphOfBullRush,
			major2: WarriorMajorGlyph.GlyphOfUnendingRage,
			major3: WarriorMajorGlyph.GlyphOfDeathFromAbove,
		}),
	}),
};

export const DefaultOptions = WarriorOptions.create({
	classOptions: {},
});

export const DefaultConsumables = ConsumesSpec.create({
	flaskId: 76088, // Flask of Winter's Bite
	foodId: 74646, // Black Pepper Ribs and Shrimp
	potId: 76095, // Potion of Mogu Power
	prepotId: 76095, // Potion of Mogu Power
});

export const OtherDefaults = {
	race: Race.RaceOrc,
	profession1: Profession.Engineering,
	profession2: Profession.Blacksmithing,
	distanceFromTarget: 25,
};
