import * as PresetUtils from '@app/preset_utils';
import { Encounter } from '@domain/encounter';
import { Player } from '@domain/player';
import { ConsumesSpec, Profession, Race, Spec } from '@generated/proto/common';
import { ArcaneMage_Options as MageOptions, MageArmor, MageMajorGlyph as MajorGlyph, MageMinorGlyph } from '@generated/proto/mage';

import { DefaultDebuffs, DefaultRaidBuffs } from '../shared/presets';
import ArcaneP3APL from './apls/arcane_t15_4pc.apl.json';
import P2BISGear from './gear_sets/p2_bis.gear.json';
import P3BISGear from './gear_sets/p3_bis.gear.json';
import P4BISGear from './gear_sets/p4_bis.gear.json';
import P5BISGear from './gear_sets/p5_bis.gear.json';
import PreBISGear from './gear_sets/prebis.gear.json';
import P1BisEpJson from './presets/ep/p1_bis.ep.json';
import P1PrebisEpJson from './presets/ep/p1_prebis.ep.json';
import P3BisEpJson from './presets/ep/p3_bis.ep.json';
import CleaveTalentsJson from './presets/talents/cleave.talents.json';
import DefaultTalentsJson from './presets/talents/default.talents.json';
// Preset options for this spec.
// Eventually we will import these values for the raid sim too, so its good to
// keep them in a separate file.
const setFrostArmor = (player: Player<Spec.SpecArcaneMage>) => {
	const specOptions = player.getSpecOptions();
	specOptions.classOptions!.defaultMageArmor = MageArmor.MageArmorFrostArmor;
	player.setSpecOptions(specOptions);
};

const setMageArmor = (player: Player<Spec.SpecArcaneMage>) => {
	const specOptions = player.getSpecOptions();
	specOptions.classOptions!.defaultMageArmor = MageArmor.MageArmorMageArmor;
	player.setSpecOptions(specOptions);
};

export const PREBIS = PresetUtils.makePresetGear('Pre-BIS', PreBISGear, { onLoad: setFrostArmor });
export const P2_BIS = PresetUtils.makePresetGear('P2 - BIS', P2BISGear, { onLoad: setFrostArmor });
export const P3_BIS = PresetUtils.makePresetGear('P3 - BIS', P3BISGear, { onLoad: setFrostArmor });
export const P4_BIS = PresetUtils.makePresetGear('P4 - BIS', P4BISGear, { onLoad: setMageArmor });
export const P5_BIS = PresetUtils.makePresetGear('P5 - BIS', P5BISGear, { onLoad: setFrostArmor });

export const ROTATION_PRESET_T15_4PC = PresetUtils.makePresetAPLRotation('Default', ArcaneP3APL);
// export const ROTATION_PRESET_CLEAVE = PresetUtils.makePresetAPLRotation('Cleave', ArcaneCleaveApl);

// Preset options for EP weights
export const P3_BIS_EP_PRESET = PresetUtils.makePresetEpWeightsFromJSON(P3BisEpJson);

export const P1_BIS_EP_PRESET = PresetUtils.makePresetEpWeightsFromJSON(P1BisEpJson);

export const P1_PREBIS_EP_PRESET = PresetUtils.makePresetEpWeightsFromJSON(P1PrebisEpJson);

// Default talents. Uses the wowhead calculator format, make the talents on
// https://wowhead.com/mop-classic/talent-calc and copy the numbers in the url.
export const ArcaneTalents = PresetUtils.makePresetTalentsFromJSON(DefaultTalentsJson, { major: MajorGlyph, minor: MageMinorGlyph });

export const ArcaneTalentsCleave = PresetUtils.makePresetTalentsFromJSON(CleaveTalentsJson, { major: MajorGlyph, minor: MageMinorGlyph });

export const ENCOUNTER_SINGLE_TARGET = PresetUtils.makePresetEncounter('Single Target', Encounter.defaultEncounterProto());
export const ENCOUNTER_CLEAVE = PresetUtils.makePresetEncounter('Cleave (2 targets)', Encounter.defaultEncounterProto(2));

export const P1_PRESET_BUILD_DEFAULT = PresetUtils.makePresetBuild('Single Target', {
	talents: ArcaneTalents,
	rotation: ROTATION_PRESET_T15_4PC,
	encounter: ENCOUNTER_SINGLE_TARGET,
});

export const P1_PRESET_BUILD_CLEAVE = PresetUtils.makePresetBuild('Cleave (2 targets)', {
	talents: ArcaneTalentsCleave,
	rotation: ROTATION_PRESET_T15_4PC,
	encounter: ENCOUNTER_CLEAVE,
});

export const DefaultArcaneOptions = MageOptions.create({
	classOptions: {
		defaultMageArmor: MageArmor.MageArmorFrostArmor,
	},
});

export const MageArmorOptions = MageOptions.create({
	classOptions: {
		defaultMageArmor: MageArmor.MageArmorMageArmor,
	},
});
export const DefaultConsumables = ConsumesSpec.create({
	flaskId: 76085, // Flask of the Warm Sun
	foodId: 74650, // Mogu Fish Stew
	potId: 76093, // Potion of the Jade Serpent
	prepotId: 76093, // Potion of the Jade Serpent
});

export const OtherDefaults = {
	distanceFromTarget: 20,
	profession1: Profession.Engineering,
	profession2: Profession.Tailoring,
	race: Race.RaceTroll,
};

export const DEFAULT_SETTINGS: PresetUtils.PresetSettings = {
	name: 'Default',
	specOptions: DefaultArcaneOptions,
	consumables: DefaultConsumables,
	raidBuffs: DefaultRaidBuffs,
	debuffs: DefaultDebuffs,
	playerOptions: OtherDefaults,
};

export const P4_SETTINGS: PresetUtils.PresetSettings = {
	name: 'P4',
	specOptions: MageArmorOptions,
	consumables: DefaultConsumables,
	raidBuffs: DefaultRaidBuffs,
	debuffs: DefaultDebuffs,
	playerOptions: OtherDefaults,
};

export const P5_SETTINGS: PresetUtils.PresetSettings = {
	name: 'P5',
	specOptions: DefaultArcaneOptions,
	consumables: DefaultConsumables,
	raidBuffs: DefaultRaidBuffs,
	debuffs: DefaultDebuffs,
	playerOptions: OtherDefaults,
};

export const T14_PRESET_BUILD = PresetUtils.makePresetBuild('T14', {
	gear: P2_BIS,
	rotation: ROTATION_PRESET_T15_4PC,
	epWeights: P1_BIS_EP_PRESET,
	settings: DEFAULT_SETTINGS,
});

export const T15_PRESET_BUILD = PresetUtils.makePresetBuild('T15', {
	gear: P3_BIS,
	rotation: ROTATION_PRESET_T15_4PC,
	epWeights: P3_BIS_EP_PRESET,
	settings: DEFAULT_SETTINGS,
});

export const T15_P4_PRESET_BUILD = PresetUtils.makePresetBuild('T15 P4', {
	gear: P4_BIS,
	rotation: ROTATION_PRESET_T15_4PC,
	epWeights: P3_BIS_EP_PRESET,
	settings: P4_SETTINGS,
});

export const T16_PRESET_BUILD = PresetUtils.makePresetBuild('T16', {
	gear: P5_BIS,
	rotation: ROTATION_PRESET_T15_4PC,
	epWeights: P3_BIS_EP_PRESET,
	settings: P5_SETTINGS,
});
