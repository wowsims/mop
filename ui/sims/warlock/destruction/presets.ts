import * as PresetUtils from '@app/preset_utils';
import { ConsumesSpec, Debuffs, IndividualBuffs, Profession, Race } from '@generated/proto/common';
import { DestructionWarlock_Options as WarlockOptions, WarlockMajorGlyph as MajorGlyph, WarlockOptions_Summon as Summon } from '@generated/proto/warlock';
export { DefaultRaidBuffs } from '../shared/presets';
import { WARLOCK_BREAKPOINTS } from '../shared/presets';
import DefaultApl from './apls/default.apl.json';
import P1PreBisGear from './gear_sets/p1-prebis.gear.json';
import P2Gear from './gear_sets/p2.gear.json';
import P4Gear from './gear_sets/p4.gear.json';
import P5Gear from './gear_sets/p5.gear.json';
import DefaultEpJson from './presets/ep/default.ep.json';
import P3EpJson from './presets/ep/p3.ep.json';
import DestructionTalentsJson from './presets/talents/destruction.talents.json';

// Preset options for this spec.
// Eventually we will import these values for the raid sim too, so its good to
// keep them in a separate file.

export const P1_PREBIS_PRESET = PresetUtils.makePresetGear('P1 - Pre-BIS', P1PreBisGear);
export const P2_PRESET = PresetUtils.makePresetGear('P2 - BIS', P2Gear);
export const P3_4_PRESET = PresetUtils.makePresetGear('P3 & P4 - BIS', P4Gear);
export const P5_PRESET = PresetUtils.makePresetGear('P5 - BIS', P5Gear);
export const DEFAULT_APL = PresetUtils.makePresetAPLRotation('Default', DefaultApl);

// Preset options for EP weights
export const DEFAULT_EP_PRESET = PresetUtils.makePresetEpWeightsFromJSON(DefaultEpJson);

export const P3_EP_PRESET = PresetUtils.makePresetEpWeightsFromJSON(P3EpJson);

// Default talents. Uses the wowhead calculator format, make the talents on
// https://wotlk.wowhead.com/talent-calc and copy the numbers in the url.

export const DestructionTalents = PresetUtils.makePresetTalentsFromJSON(DestructionTalentsJson, { major: MajorGlyph });

export const DefaultOptions = WarlockOptions.create({
	classOptions: {
		summon: Summon.Imp,
		detonateSeed: false,
	},
});

export const DefaultConsumables = ConsumesSpec.create({
	flaskId: 76085, // Flask of the Warm Sun
	foodId: 74650, // Mogu Fish Stew
	potId: 76093, //Potion of the Jade Serpent
	prepotId: 76093, // Potion of the Jade Serpent
});


export const DefaultIndividualBuffs = IndividualBuffs.create({});

export const DefaultDebuffs = Debuffs.create({
	curseOfElements: true,
	weakenedArmor: true,
	physicalVulnerability: true,
});

export const OtherDefaults = {
	race: Race.RaceTroll,
	distanceFromTarget: 25,
	profession1: Profession.Engineering,
	profession2: Profession.Tailoring,
	channelClipDelay: 150,
};

export const DESTRUCTION_BREAKPOINTS = WARLOCK_BREAKPOINTS;
