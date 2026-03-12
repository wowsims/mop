import * as PresetUtils from '../../core/preset_utils';
import { ConsumesSpec, Debuffs, Glyphs, IndividualBuffs, Profession, PseudoStat, Race, RaidBuffs, Stat } from '../../core/proto/common';
import { PriestMajorGlyph as MajorGlyph, PriestMinorGlyph as MinorGlyph, PriestOptions_Armor, ShadowPriest_Options as Options } from '../../core/proto/priest';
import { SavedTalents } from '../../core/proto/ui';
import { Stats, UnitStat, UnitStatPresets } from '../../core/proto_utils/stats';
import { defaultRaidBuffMajorDamageCooldowns } from '../../core/proto_utils/utils';
import DefaultApl from './apls/default.apl.json';
import T15Apl from './apls/t15.apl.json';
import P2Gear from './gear_sets/p2.gear.json';
import P3Gear from './gear_sets/p3.gear.json';
import PreRaidGear from './gear_sets/pre_raid.gear.json';

// Preset options for this spec.
// Eventually we will import these values for the raid sim too, so its good to
// keep them in a separate file.
export const PRE_RAID_PRESET = PresetUtils.makePresetGear('Pre Raid Preset', PreRaidGear);
export const P2_PRESET = PresetUtils.makePresetGear('P2 Preset', P2Gear);
export const P3_PRESET = PresetUtils.makePresetGear('P3 Preset', P3Gear);
export const ROTATION_PRESET_DEFAULT = PresetUtils.makePresetAPLRotation('Default', DefaultApl);
export const ROTATION_PRESET_T15 = PresetUtils.makePresetAPLRotation('T15', T15Apl);

// Preset options for EP weights
export const P1_EP_PRESET = PresetUtils.makePresetEpWeights(
	'Item Level < 500',
	Stats.fromMap({
		[Stat.StatIntellect]: 1.0,
		[Stat.StatSpirit]: 0.9,
		[Stat.StatSpellPower]: 0.98,
		[Stat.StatHitRating]: 0.85,
		[Stat.StatCritRating]: 0.46,
		[Stat.StatHasteRating]: 0.49,
		[Stat.StatMasteryRating]: 0.44,
	}),
);
export const P2_EP_PRESET = PresetUtils.makePresetEpWeights(
	'Item Level >= 500',
	Stats.fromMap({
		[Stat.StatIntellect]: 1.0,
		[Stat.StatSpirit]: 0.9,
		[Stat.StatSpellPower]: 0.98,
		[Stat.StatHitRating]: 0.85,
		[Stat.StatCritRating]: 0.46,
		[Stat.StatHasteRating]: 0.59,
		[Stat.StatMasteryRating]: 0.44,
	}),
);
export const P3_EP_PRESET = PresetUtils.makePresetEpWeights(
	'Item Level >= 525',
	Stats.fromMap({
		[Stat.StatIntellect]: 1.0,
		[Stat.StatSpirit]: 0.9,
		[Stat.StatSpellPower]: 0.98,
		[Stat.StatHitRating]: 0.85,
		[Stat.StatCritRating]: 0.49,
		[Stat.StatHasteRating]: 0.75,
		[Stat.StatMasteryRating]: 0.51,
	}),
);

export const SHADOW_BREAKPOINTS: UnitStatPresets = {
	unitStat: UnitStat.fromPseudoStat(PseudoStat.PseudoStatSpellHastePercent),
	presets: new Map([
		['BL - 9-tick - SWP', 8.98193],
		['BL - 9-tick - DP', 9.03343],
		['BL - 8-tick - VT', 15.35578],
		['BL - 10-tick - SWP', 21.8101],
		['BL - 10-tick - DP', 21.81012],
		['8-tick - DP', 24.92194],
		['8-tick - SWP', 24.97397],
		['7-tick - VT', 30.01084],
		['BL - 9-tick - VT', 30.7845],
		['BL - 11-tick - SWP', 34.59857],
		['BL - 11-tick - DP', 34.59858],
		['9-tick - SWP', 41.67651],
		['9-tick - DP', 41.74346],
		['BL - 10-tick - VT', 46.19528],
		['BL - 12-tick - SWP', 47.40929],
		['BL - 12-tick - DP', 47.50353],
		['8-tick - VT', 49.96252],
		['10-tick - SWP', 58.35314],
		['10-tick - DP', 58.35315],
		['BL - 13-tick - SWP', 60.31209],
		['BL - 13-tick - DP', 60.42355],
		['BL - 11-tick - VT', 61.54655],
		['9-tick - VT', 70.01985],
		['BL - 14-tick - SWP', 73.0553],
		['BL - 14-tick - DP', 73.05533],
		['11-tick - SWP', 74.97814],
		['11-tick - DP', 74.97816],
		['BL - 12-tick - VT', 76.90245],
		['BL - 15-tick - SWP', 85.87938],
		['BL - 15-tick - DP', 86.02925],
		['10-tick - VT', 90.05386],
		['12-tick - SWP', 91.63208],
		['12-tick - DP', 91.75459],
		['BL - 13-tick - VT', 92.38787],
		['BL - 16-tick - DP', 98.51122],
		['BL - 16-tick - SWP', 98.68209],
		['BL - 14-tick - VT', 107.61966],
		['13-tick - SWP', 108.40571],
		['13-tick - DP', 108.55062],
		['11-tick - VT', 110.01052],
		['BL - 17-tick - SWP', 111.61784],
		['BL - 17-tick - DP', 111.61788],
		['BL - 15-tick - VT', 123.07323],
		['BL - 18-tick - SWP', 124.37458],
		['BL - 18-tick - DP', 124.59299],
		['14-tick - SWP', 124.9719],
		['14-tick - DP', 124.97193],
		['12-tick - VT', 129.97319],
		['BL - 19-tick - DP', 137.05116],
		['BL - 19-tick - SWP', 137.29486],
		['BL - 16-tick - VT', 138.52119],
		['15-tick - SWP', 141.64319],
		['15-tick - DP', 141.83803],
		['13-tick - VT', 150.10423],
		['BL - 20-tick - DP', 150.15643],
		['16-tick - DP', 158.06458],
		['16-tick - SWP', 158.28672],
		['BL - 21-tick - DP', 162.98497],
		['14-tick - VT', 169.90556],
		['17-tick - SWP', 175.10319],
		['17-tick - DP', 175.10324],
		['BL - 22-tick - DP', 175.21683],
		['15-tick - VT', 189.99519],
		['18-tick - SWP', 191.68695],
		['18-tick - DP', 191.97089],
		['19-tick - DP', 208.1665],
		['19-tick - SWP', 208.48332],
		['16-tick - VT', 210.07755],
		['20-tick - DP', 225.20336],
		['21-tick - DP', 241.88046],
		['22-tick - DP', 257.78188],
	]),
};

// Default talents. Uses the wowhead calculator format, make the talents on
// https://www.wowhead.com/mop-classic/talent-calc/priest and copy the numbers in the url.
export const StandardTalents = {
	name: 'Standard',
	data: SavedTalents.create({
		talentsString: '223113',
		glyphs: Glyphs.create({}),
	}),
};

export const DefaultOptions = Options.create({
	classOptions: {
		armor: PriestOptions_Armor.InnerFire,
	},
});

export const DefaultConsumables = ConsumesSpec.create({
	flaskId: 76085, // Flask of the Warm Sun
	foodId: 74650, // Mogu Fish Stew
	potId: 76093, //Potion of the Jade Serpent
	prepotId: 76093, // Potion of the Jade Serpent
});

export const DefaultRaidBuffs = RaidBuffs.create({
	...defaultRaidBuffMajorDamageCooldowns(),
	arcaneBrilliance: true,
	blessingOfKings: true,
	mindQuickening: true,
	leaderOfThePack: true,
	blessingOfMight: true,
	unholyAura: true,
	bloodlust: true,
});

export const DefaultIndividualBuffs = IndividualBuffs.create({});

export const DefaultDebuffs = Debuffs.create({
	curseOfElements: true,
});

export const OtherDefaults = {
	channelClipDelay: 100,
	distanceFromTarget: 28,
	profession1: Profession.Engineering,
	profession2: Profession.Tailoring,
};

export const PRESET_BUILD_T14 = PresetUtils.makePresetBuild('T14', {
	gear: P2_PRESET,
	talents: StandardTalents,
	rotation: ROTATION_PRESET_DEFAULT,
	epWeights: P2_EP_PRESET,
});

export const PRESET_BUILD_T15 = PresetUtils.makePresetBuild('T15', {
	gear: P3_PRESET,
	talents: StandardTalents,
	rotation: ROTATION_PRESET_T15,
	epWeights: P3_EP_PRESET,
});
