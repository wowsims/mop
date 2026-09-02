import * as PresetUtils from '@app/preset_utils';
import { UnitStat, UnitStatPresets } from '@domain/proto_utils/stats';
import { defaultRaidBuffMajorDamageCooldowns } from '@domain/proto_utils/utils';
import { ConsumesSpec, Debuffs, IndividualBuffs, PartyBuffs, Profession, PseudoStat, RaidBuffs, UnitReference } from '@generated/proto/common';
import { BalanceDruid_Options as BalanceDruidOptions, DruidMajorGlyph } from '@generated/proto/druid';

import StandardApl from './apls/standard.apl.json';
import PreraidGear from './gear_sets/preraid.gear.json';
import T14Gear from './gear_sets/t14.gear.json';
import T15Gear from './gear_sets/t15.gear.json';
import T16Gear from './gear_sets/t16.gear.json';
import P2BisEpJson from './presets/ep/p2_bis.ep.json';
import P3BisEpJson from './presets/ep/p3_bis.ep.json';
import P5BisEpJson from './presets/ep/p5_bis.ep.json';
import StandardTalentsJson from './presets/talents/standard.talents.json';

export const PreraidPresetGear = PresetUtils.makePresetGear('Pre-raid', PreraidGear);
export const T14PresetGear = PresetUtils.makePresetGear('T14', T14Gear);
export const T15PresetGear = PresetUtils.makePresetGear('T15', T15Gear);
export const T16PresetGear = PresetUtils.makePresetGear('T16', T16Gear);

export const StandardRotation = PresetUtils.makePresetAPLRotation('Standard', StandardApl);

export const P2_BIS_EP_PRESET = PresetUtils.makePresetEpWeightsFromJSON(P2BisEpJson);

export const P3_BIS_EP_PRESET = PresetUtils.makePresetEpWeightsFromJSON(P3BisEpJson);

export const P5_BIS_EP_PRESET = PresetUtils.makePresetEpWeightsFromJSON(P5BisEpJson);

// Default talents. Uses the wowhead calculator format, make the talents on
// https://wowhead.com/mop-classic/talent-calc and copy the numbers in the url.
export const StandardTalents = PresetUtils.makePresetTalentsFromJSON(StandardTalentsJson, { major: DruidMajorGlyph });

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

const defaultPresetSettings = {
	name: 'Settings',
	playerOptions: OtherDefaults,
};

export const PresetPreraidBuild = PresetUtils.makePresetBuild('Pre-raid', {
	gear: PreraidPresetGear,
	talents: StandardTalents,
	rotation: StandardRotation,
	epWeights: P2_BIS_EP_PRESET,
	settings: defaultPresetSettings,
});

export const T14PresetBuild = PresetUtils.makePresetBuild('T14', {
	gear: T14PresetGear,
	talents: StandardTalents,
	rotation: StandardRotation,
	epWeights: P2_BIS_EP_PRESET,
	settings: defaultPresetSettings,
});

export const T15PresetBuild = PresetUtils.makePresetBuild('T15', {
	gear: T15PresetGear,
	talents: StandardTalents,
	rotation: StandardRotation,
	epWeights: P3_BIS_EP_PRESET,
	settings: defaultPresetSettings,
});

export const T16PresetBuild = PresetUtils.makePresetBuild('T16', {
	gear: T16PresetGear,
	talents: StandardTalents,
	rotation: StandardRotation,
	epWeights: P3_BIS_EP_PRESET,
	settings: {
		name: 'T16',
		playerOptions: {
			...OtherDefaults,
			profession1: Profession.Engineering,
			profession2: Profession.Blacksmithing,
		},
	},
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
