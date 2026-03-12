import * as PresetUtils from '../../core/preset_utils.js';
import { ConsumesSpec, Debuffs, Glyphs, IndividualBuffs, PartyBuffs, Profession, PseudoStat, RaidBuffs, Stat, UnitReference } from '../../core/proto/common.js';
import { BalanceDruid_Options as BalanceDruidOptions, DruidMajorGlyph } from '../../core/proto/druid.js';
import { SavedTalents } from '../../core/proto/ui.js';
import { Stats, UnitStat, UnitStatPresets } from '../../core/proto_utils/stats';
import { defaultRaidBuffMajorDamageCooldowns } from '../../core/proto_utils/utils';
import StandardApl from './apls/standard.apl.json';
import PreraidGear from './gear_sets/preraid.gear.json';
import T14Gear from './gear_sets/t14.gear.json';
import T14UpgradedGear from './gear_sets/t14-upgraded.gear.json';
import T15Gear from './gear_sets/t15.gear.json';
import T16Gear from './gear_sets/t16.gear.json';

export const PreraidPresetGear = PresetUtils.makePresetGear('Pre-raid', PreraidGear);
export const T14PresetGear = PresetUtils.makePresetGear('T14', T14Gear);
export const T14UpgradedPresetGear = PresetUtils.makePresetGear('T14 - Upgraded', T14UpgradedGear);
export const T15PresetGear = PresetUtils.makePresetGear('T15', T15Gear);
export const T16PresetGear = PresetUtils.makePresetGear('T16 (WIP)', T16Gear);

export const StandardRotation = PresetUtils.makePresetAPLRotation('Standard', StandardApl);

export const P2_BIS_EP_PRESET = PresetUtils.makePresetEpWeights(
	'Item Level < 525',
	Stats.fromMap({
		[Stat.StatIntellect]: 1,
		[Stat.StatSpirit]: 0.88,
		[Stat.StatSpellPower]: 0.80,
		[Stat.StatHitRating]: 0.88,
		[Stat.StatCritRating]: 0.54,
		[Stat.StatHasteRating]: 0.55,
		[Stat.StatMasteryRating]: 0.46,
	}),
);

export const P3_BIS_EP_PRESET = PresetUtils.makePresetEpWeights(
	'Item Level >= 525',
	Stats.fromMap({
		[Stat.StatIntellect]: 1,
		[Stat.StatSpirit]: 1.0,
		[Stat.StatSpellPower]: 0.79,
		[Stat.StatHitRating]: 1.0,
		[Stat.StatCritRating]: 0.57,
		[Stat.StatHasteRating]: 0.64,
		[Stat.StatMasteryRating]: 0.53,
	}),
);

// Default talents. Uses the wowhead calculator format, make the talents on
// https://wowhead.com/mop-classic/talent-calc and copy the numbers in the url.
export const StandardTalents = {
	name: 'Standard',
	data: SavedTalents.create({
		talentsString: '113223',
		glyphs: Glyphs.create({
			major1: DruidMajorGlyph.GlyphOfHealingTouch,
			major2: DruidMajorGlyph.GlyphOfStampede,
			major3: DruidMajorGlyph.GlyphOfRebirth,
		}),
	}),
};

export const DefaultOptions = BalanceDruidOptions.create({
	classOptions: {
		innervateTarget: UnitReference.create(),
	},
});

export const DefaultConsumables = ConsumesSpec.create({
	flaskId: 76085, // Flask of the Warm Sun
	foodId: 74650, // Mogu Fish Stew
	potId: 76093, // Potion of the Jade Serpent
	prepotId: 76093, // Potion of the Jade Serpent
});

export const DefaultRaidBuffs = RaidBuffs.create({
	...defaultRaidBuffMajorDamageCooldowns(),
	markOfTheWild: true, // stats
	darkIntent: true, // spell power
	moonkinAura: true, // spell haste
	leaderOfThePack: true, // crit %
	blessingOfMight: true, // mastery
	bloodlust: true, // major haste
});

export const DefaultIndividualBuffs = IndividualBuffs.create({});

export const DefaultPartyBuffs = PartyBuffs.create({});

export const DefaultDebuffs = Debuffs.create({
	curseOfElements: true, // spell dmg taken
});

export const OtherDefaults = {
	distanceFromTarget: 20,
	profession1: Profession.Engineering,
	profession2: Profession.Tailoring,
};

export const PresetPreraidBuild = PresetUtils.makePresetBuild('Pre-raid', {
	gear: PreraidPresetGear,
	talents: StandardTalents,
	rotation: StandardRotation,
	epWeights: P2_BIS_EP_PRESET,
});

export const T14PresetBuild = PresetUtils.makePresetBuild('T14', {
	gear: T14UpgradedPresetGear,
	talents: StandardTalents,
	rotation: StandardRotation,
	epWeights: P2_BIS_EP_PRESET,
});

export const T15PresetBuild = PresetUtils.makePresetBuild('T15', {
	gear: T15PresetGear,
	talents: StandardTalents,
	rotation: StandardRotation,
	epWeights: P3_BIS_EP_PRESET,
});

export const T16PresetBuild = PresetUtils.makePresetBuild('T16', {
	gear: T16PresetGear,
	talents: StandardTalents,
	rotation: StandardRotation,
	epWeights: P3_BIS_EP_PRESET,
});

export const BALANCE_BREAKPOINTS: UnitStatPresets = {
	unitStat: UnitStat.fromPseudoStat(PseudoStat.PseudoStatSpellHastePercent),
	presets: new Map([
		['9-tick MF/SF', 5.5618],
		['10-tick MF/SF', 18.0272],
		['11-tick MF/SF', 30.4347],
		// ['12-tick MF/SF', 42.8444],
		// ['13-tick MF/SF', 55.3489],
		// ['14-tick MF/SF', 67.627],
	]),
};

export const BALANCE_T14_4P_BREAKPOINTS: UnitStatPresets = {
	unitStat: UnitStat.fromPseudoStat(PseudoStat.PseudoStatSpellHastePercent),
	presets: new Map([
		['10-tick MF/SF', 3.2431],
		['11-tick MF/SF', 14.1536],
		['12-tick MF/SF', 24.9824],
		// ['13-tick MF/SF', 35.9227],
		// ['14-tick MF/SF', 46.7002],
		// ['15-tick MF/SF', 57.6013],
		// ['16-tick MF/SF', 68.4388],
	]),
};
