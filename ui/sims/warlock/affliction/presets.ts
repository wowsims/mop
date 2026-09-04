import * as PresetUtils from '@app/preset_utils';
import { Encounter } from '@domain/encounter';
import { ConsumesSpec, Debuffs, IndividualBuffs, Profession, Race } from '@generated/proto/common';
import {
	AfflictionWarlock_Options as WarlockOptions,
	WarlockMajorGlyph as MajorGlyph,
	WarlockMinorGlyph as MinorGlyph,
	WarlockOptions_Summon as Summon,
} from '@generated/proto/warlock';
export { DefaultRaidBuffs } from '../shared/presets';
import { WARLOCK_BREAKPOINTS } from '../shared/presets';
import DefaultApl from './apls/default.apl.json';
import MultiTargetApl from './apls/multitarget.apl.json';
import P1Gear from './gear_sets/p1.gear.json';
import P2Gear from './gear_sets/p2.gear.json';
import P3Gear from './gear_sets/p3.gear.json';
import P5Gear from './gear_sets/p5.gear.json';
import PreraidGear from './gear_sets/preraid.gear.json';
import P1EpJson from './presets/ep/p1.ep.json';
import P2EpJson from './presets/ep/p2.ep.json';
import P5EpJson from './presets/ep/p5.ep.json';
import AfflictionTalentsJson from './presets/talents/affliction.talents.json';

// Preset options for this spec.
// Eventually we will import these values for the raid sim too, so its good to
// keep them in a separate file.

export const PRERAID_PRESET = PresetUtils.makePresetGear('Pre-raid', PreraidGear);
export const P1_PRESET = PresetUtils.makePresetGear('P1 - BIS', P1Gear);
export const P2_PRESET = PresetUtils.makePresetGear('P2 - BIS', P2Gear);
export const P3_PRESET = PresetUtils.makePresetGear('P3/P4 - BIS', P3Gear);
export const P5_PRESET = PresetUtils.makePresetGear('P5 - BIS', P5Gear);

export const APL_Default = PresetUtils.makePresetAPLRotation('Single Target', DefaultApl);
export const APL_Multitarget = PresetUtils.makePresetAPLRotation('Multi Target', MultiTargetApl);

// Preset options for EP weights
export const P1_BIS_EP_PRESET = PresetUtils.makePresetEpWeightsFromJSON(P1EpJson);

export const P2_BIS_EP_PRESET = PresetUtils.makePresetEpWeightsFromJSON(P2EpJson);

export const P5_BIS_EP_PRESET = PresetUtils.makePresetEpWeightsFromJSON(P5EpJson);

// Default talents. Uses the wowhead calculator format, make the talents on
// https://wowhead.com/mop-classic/talent-calc and copy the numbers in the url.

export const AfflictionTalents = PresetUtils.makePresetTalentsFromJSON(AfflictionTalentsJson, { major: MajorGlyph, minor: MinorGlyph });

export const DefaultOptions = WarlockOptions.create({
	classOptions: {
		summon: Summon.Felhunter,
	},
	exhaleWindow: 250,
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
	profession2: Profession.Herbalism,
	channelClipDelay: 150,
};

export const AFFLICTION_BREAKPOINTS = WARLOCK_BREAKPOINTS;

const ENCOUNTER_SINGLETARGET = PresetUtils.makePresetEncounter('Single Target Dummy', Encounter.defaultEncounterProto());
const ENCOUNTER_MULTITARGET = PresetUtils.makePresetEncounter('Multitarget', Encounter.defaultEncounterProto(3));

export const PRESET_SINGLETARGET = PresetUtils.makePresetBuild('Single Target', {
	talents: AfflictionTalents,
	rotation: APL_Default,
	encounter: ENCOUNTER_SINGLETARGET,
});

export const PRESET_MULTITARGET = PresetUtils.makePresetBuild('Multi Target', {
	talents: AfflictionTalents,
	rotation: APL_Multitarget,
	encounter: ENCOUNTER_MULTITARGET,
});
