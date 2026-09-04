import * as PresetUtils from '@app/preset_utils';
import { Encounter } from '@domain/encounter';
import { ConsumesSpec, Profession, Race } from '@generated/proto/common';
import { FrostMage_Options as MageOptions, MageArmor, MageMajorGlyph, MageMinorGlyph } from '@generated/proto/mage';

import FrostApl from './apls/frost.apl.json';
import FrostAoeApl from './apls/frost_aoe.apl.json';
import P1BISGear from './gear_sets/p1_bis.gear.json';
import P1PreBISGear from './gear_sets/p1_prebis.gear.json';
import P2BSISGear from './gear_sets/p2_bis.gear.json';
import P3BSISGear from './gear_sets/p3_bis.gear.json';
import P4BISGear from './gear_sets/p4_bis.gear.json';
import P5BISGear from './gear_sets/p5_bis.gear.json';
import P1BisEpJson from './presets/ep/p1_bis.ep.json';
import P1PrebisEpJson from './presets/ep/p1_prebis.ep.json';
import P3BisEpJson from './presets/ep/p3_bis.ep.json';
import P5BisEpJson from './presets/ep/p5_bis.ep.json';
import AoeTalentsJson from './presets/talents/aoe.talents.json';
import CleaveTalentsJson from './presets/talents/cleave.talents.json';
import DefaultTalentsJson from './presets/talents/default.talents.json';
// Preset options for this spec.
// Eventually we will import these values for the raid sim too, so its good to
// keep them in a separate file.

export const P1_PREBIS = PresetUtils.makePresetGear('P1 - Pre-BIS', P1PreBISGear);
export const P1_BIS = PresetUtils.makePresetGear('P1 - BIS', P1BISGear);
export const P2_BIS = PresetUtils.makePresetGear('P2 - BIS', P2BSISGear);
export const P3_BIS = PresetUtils.makePresetGear('P3 - BIS', P3BSISGear);
export const P4_BIS = PresetUtils.makePresetGear('P4 - BIS', P4BISGear);
export const P5_BIS = PresetUtils.makePresetGear('P5 - BIS', P5BISGear);

export const ROTATION_PRESET_DEFAULT = PresetUtils.makePresetAPLRotation('Default', FrostApl);
export const ROTATION_PRESET_AOE = PresetUtils.makePresetAPLRotation('AOE', FrostAoeApl);
// export const ROTATION_PRESET_CLEAVE = PresetUtils.makePresetAPLRotation('Cleave', FrostCleaveApl);

// Preset options for EP weights
export const P5_BIS_EP_PRESET = PresetUtils.makePresetEpWeightsFromJSON(P5BisEpJson);

export const P3_BIS_EP_PRESET = PresetUtils.makePresetEpWeightsFromJSON(P3BisEpJson);

export const P1_BIS_EP_PRESET = PresetUtils.makePresetEpWeightsFromJSON(P1BisEpJson);

export const P1_PREBIS_EP_PRESET = PresetUtils.makePresetEpWeightsFromJSON(P1PrebisEpJson);

// Default talents. Uses the wowhead calculator format, make the talents on
// https://wowhead.com/mop-classic/talent-calc and copy the numbers in the url.

export const FrostDefaultTalents = PresetUtils.makePresetTalentsFromJSON(DefaultTalentsJson, { major: MageMajorGlyph, minor: MageMinorGlyph });

export const DefaultConsumables = ConsumesSpec.create({
	flaskId: 76085, // Flask of the Warm Sun
	foodId: 74650, // Mogu Fish Stew
	potId: 76093, // Potion of the Jade Serpent
	prepotId: 76093, // Potion of the Jade Serpent
});

export const FrostTalentsCleave = PresetUtils.makePresetTalentsFromJSON(CleaveTalentsJson, { major: MageMajorGlyph, minor: MageMinorGlyph });

export const FrostTalentsAoE = PresetUtils.makePresetTalentsFromJSON(AoeTalentsJson, { major: MageMajorGlyph, minor: MageMinorGlyph });

export const DefaultFrostOptions = MageOptions.create({
	classOptions: {
		defaultMageArmor: MageArmor.MageArmorFrostArmor,
	},
});

export const OtherDefaults = {
	distanceFromTarget: 20,
	profession1: Profession.Engineering,
	profession2: Profession.Tailoring,
	race: Race.RaceOrc,
};

export const ENCOUNTER_SINGLE_TARGET = PresetUtils.makePresetEncounter('Single Target', Encounter.defaultEncounterProto());
export const ENCOUNTER_CLEAVE = PresetUtils.makePresetEncounter('Cleave', Encounter.defaultEncounterProto(2));
export const ENCOUNTER_AOE = PresetUtils.makePresetEncounter('AoE (5+)', Encounter.defaultEncounterProto(5));

export const P1_PRESET_BUILD_DEFAULT = PresetUtils.makePresetBuild('Single Target', {
	talents: FrostDefaultTalents,
	rotation: ROTATION_PRESET_DEFAULT,
	encounter: ENCOUNTER_SINGLE_TARGET,
});

export const P1_PRESET_BUILD_CLEAVE = PresetUtils.makePresetBuild('Cleave', {
	talents: FrostTalentsCleave,
	rotation: ROTATION_PRESET_DEFAULT,
	encounter: ENCOUNTER_CLEAVE,
});

export const P1_PRESET_BUILD_AOE = PresetUtils.makePresetBuild('AoE (5+)', {
	talents: FrostTalentsAoE,
	rotation: ROTATION_PRESET_AOE,
	encounter: ENCOUNTER_AOE,
});

export const T16_PRESET_BUILD = PresetUtils.makePresetBuild('T16', {
	gear: P5_BIS,
	rotation: ROTATION_PRESET_DEFAULT,
	epWeights: P5_BIS_EP_PRESET,
});
