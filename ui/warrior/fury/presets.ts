import { Player } from '../../core/player';
import * as PresetUtils from '../../core/preset_utils';
import { ConsumesSpec, Glyphs, HandType, ItemSlot, Profession, PseudoStat, Race, Spec, Stat } from '../../core/proto/common';
import { SavedTalents } from '../../core/proto/ui';
import { FuryWarrior_Options as WarriorOptions, WarriorMajorGlyph } from '../../core/proto/warrior';
import { Stats } from '../../core/proto_utils/stats';
import DefaultFuryApl from './apls/default.apl.json';
import P2FurySMFGear from './gear_sets/p2_fury_smf.gear.json';
import P2FuryTGGear from './gear_sets/p2_fury_tg.gear.json';
import P4FuryTGGear from './gear_sets/p4_fury_tg.gear.json';
import P5FuryTGGear from './gear_sets/p5_fury_tg.gear.json';
import PreraidFurySMFGear from './gear_sets/preraid_fury_smf.gear.json';
import PreraidFuryTGGear from './gear_sets/preraid_fury_tg.gear.json';

// Preset options for this spec.
// Eventually we will import these values for the raid sim too, so its good to
// keep them in a separate file.

// Handlers for spec specific load checks
const FURY_SMF_PRESET_OPTIONS = {
	onLoad: (player: Player<Spec.SpecFuryWarrior>) => {
		PresetUtils.makeSpecChangeWarningToast(
			[
				{
					condition: (player: Player<Spec.SpecFuryWarrior>) =>
						player.getEquippedItem(ItemSlot.ItemSlotMainHand)?.item.handType === HandType.HandTypeTwoHand,
					message: 'Check your gear: You have a two-handed weapon equipped, but the selected option is for one-handed weapons.',
				},
			],
			player,
		);
	},
};
const FURY_TG_PRESET_OPTIONS = {
	onLoad: (player: Player<any>) => {
		PresetUtils.makeSpecChangeWarningToast(
			[
				{
					condition: (player: Player<Spec.SpecFuryWarrior>) =>
						player.getEquippedItem(ItemSlot.ItemSlotMainHand)?.item.handType === HandType.HandTypeOneHand,
					message: 'Check your gear: You have a one-handed weapon equipped, but the selected option is for two-handed weapons.',
				},
			],
			player,
		);
	},
};

export const PRERAID_FURY_SMF_PRESET = PresetUtils.makePresetGear('Pre-BIS - 1H', PreraidFurySMFGear, FURY_SMF_PRESET_OPTIONS);
export const PRERAID_FURY_TG_PRESET = PresetUtils.makePresetGear('Pre-BIS - 2H', PreraidFuryTGGear, FURY_TG_PRESET_OPTIONS);
export const P2_BIS_FURY_SMF_PRESET = PresetUtils.makePresetGear('P2 - 1H', P2FurySMFGear, FURY_SMF_PRESET_OPTIONS);
export const P2_BIS_FURY_TG_PRESET = PresetUtils.makePresetGear('P2 - 2H', P2FuryTGGear, FURY_TG_PRESET_OPTIONS);
export const P3_4_BIS_FURY_TG_PRESET = PresetUtils.makePresetGear('P3 & P4 - 2H', P4FuryTGGear, FURY_TG_PRESET_OPTIONS);
export const P5_BIS_FURY_TG_PRESET = PresetUtils.makePresetGear('P5 - 2H (WIP)', P5FuryTGGear, FURY_TG_PRESET_OPTIONS);

export const FURY_DEFAULT_ROTATION = PresetUtils.makePresetAPLRotation('Default', DefaultFuryApl);

// Preset options for EP weights
export const P2_FURY_SMF_EP_PRESET = PresetUtils.makePresetEpWeights(
	'P2 - SMF',
	Stats.fromMap(
		{
			[Stat.StatStrength]: 1.0,
			[Stat.StatAgility]: 0.06,
			[Stat.StatAttackPower]: 0.45,
			[Stat.StatExpertiseRating]: 1.19,
			[Stat.StatHitRating]: 1.37,
			[Stat.StatCritRating]: 0.94,
			[Stat.StatHasteRating]: 0.41,
			[Stat.StatMasteryRating]: 0.59,
		},
		{
			[PseudoStat.PseudoStatMainHandDps]: 2.15,
			[PseudoStat.PseudoStatOffHandDps]: 1.31,
		},
	),
	FURY_SMF_PRESET_OPTIONS,
);

export const P2_FURY_TG_EP_PRESET = PresetUtils.makePresetEpWeights(
	'P2 - TG',
	Stats.fromMap(
		{
			[Stat.StatStrength]: 1.0,
			[Stat.StatAgility]: 0.07,
			[Stat.StatAttackPower]: 0.45,
			[Stat.StatExpertiseRating]: 1.42,
			[Stat.StatHitRating]: 1.62,
			[Stat.StatCritRating]: 1.07,
			[Stat.StatHasteRating]: 0.41,
			[Stat.StatMasteryRating]: 0.7,
		},
		{
			[PseudoStat.PseudoStatMainHandDps]: 2.59,
			[PseudoStat.PseudoStatOffHandDps]: 1.11,
		},
	),
	FURY_TG_PRESET_OPTIONS,
);

export const P3_4_FURY_TG_EP_PRESET = PresetUtils.makePresetEpWeights(
	'P3 & P4 - TG',
	Stats.fromMap(
		{
			[Stat.StatStrength]: 1.0,
			[Stat.StatAgility]: 0.07,
			[Stat.StatAttackPower]: 0.45,
			[Stat.StatExpertiseRating]: 1.89,
			[Stat.StatHitRating]: 2.15,
			[Stat.StatCritRating]: 0.96,
			[Stat.StatHasteRating]: 0.53,
			[Stat.StatMasteryRating]: 0.9,
		},
		{
			[PseudoStat.PseudoStatMainHandDps]: 2.56,
			[PseudoStat.PseudoStatOffHandDps]: 1.3,
		},
	),
	FURY_TG_PRESET_OPTIONS,
);

export const P5_FURY_TG_EP_PRESET = PresetUtils.makePresetEpWeights(
	'P5 - TG',
	Stats.fromMap(
		{
			[Stat.StatStrength]: 1.0,
			[Stat.StatAgility]: 0.12,
			[Stat.StatAttackPower]: 0.45,
			[Stat.StatExpertiseRating]: 3.04,
			[Stat.StatHitRating]: 3.61,
			[Stat.StatCritRating]: 1.98,
			[Stat.StatHasteRating]: 0.79,
			[Stat.StatMasteryRating]: 1.2,
		},
		{
			[PseudoStat.PseudoStatMainHandDps]: 2.58,
			[PseudoStat.PseudoStatOffHandDps]: 1.26,
		},
	),
	FURY_TG_PRESET_OPTIONS,
);

// Default talents. Uses the wowhead calculator format, make the talents on
// https://wowhead.com/mop-classic/talent-calc and copy the numbers in the url.

export const FurySMFTalents = {
	name: 'SMF',
	data: SavedTalents.create({
		talentsString: '133333',
		glyphs: Glyphs.create({
			major1: WarriorMajorGlyph.GlyphOfBullRush,
			major2: WarriorMajorGlyph.GlyphOfDeathFromAbove,
			major3: WarriorMajorGlyph.GlyphOfUnendingRage,
		}),
	}),
	...FURY_SMF_PRESET_OPTIONS,
};

export const FuryTGTalents = {
	name: 'TG',
	data: SavedTalents.create({
		talentsString: '133133',
		glyphs: Glyphs.create({
			major1: WarriorMajorGlyph.GlyphOfBullRush,
			major2: WarriorMajorGlyph.GlyphOfDeathFromAbove,
			major3: WarriorMajorGlyph.GlyphOfUnendingRage,
		}),
	}),
	...FURY_TG_PRESET_OPTIONS,
};

export const DefaultOptions = WarriorOptions.create({
	classOptions: {},
	syncType: 0,
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

export const P3_4_PRESET_BUILD_TG = PresetUtils.makePresetBuild('P3 & P4 - TG', {
	gear: P3_4_BIS_FURY_TG_PRESET,
	talents: FuryTGTalents,
	epWeights: P3_4_FURY_TG_EP_PRESET,
});
export const P5_PRESET_BUILD_TG = PresetUtils.makePresetBuild('P5 - TG (WIP)', {
	gear: P5_BIS_FURY_TG_PRESET,
	talents: FuryTGTalents,
	epWeights: P5_FURY_TG_EP_PRESET,
});
