import * as PresetUtils from '@app/preset_utils';
import { Encounter } from '@domain/encounter';
import { defaultRaidBuffMajorDamageCooldowns } from '@domain/proto_utils/utils';

import { Class, ConsumesSpec, Debuffs, Glyphs, Profession, Race, RaidBuffs } from '../../core/proto/common';
import { ElementalShaman_Options as ElementalShamanOptions, FeleAutocastSettings, ShamanMajorGlyph, ShamanShield } from '../../core/proto/shaman';
import { SavedTalents } from '../../core/proto/ui';
import AoEApl from './apls/aoe.apl.json';
import CleaveApl from './apls/cleave.apl.json';
import P5Apl from './apls/p5.apl.json';
import P1Gear from './gear_sets/p1.gear.json';
import P2Gear from './gear_sets/p2.gear.json';
import P3Gear from './gear_sets/p3.gear.json';
import P4BiSGear from './gear_sets/p4bis.gear.json';
import P4P3UpgradedGear from './gear_sets/p4p3upgraded.gear.json';
import P5Gear from './gear_sets/p5.gear.json';
import PreraidGear from './gear_sets/preraid.gear.json';
import EpAoeJson from './presets/ep/aoe.ep.json';
import EpP2Json from './presets/ep/p2.ep.json';
import EpP3Json from './presets/ep/p3.ep.json';
import TalentsP2Json from './presets/talents/p2.talents.json';
import TalentsP3Json from './presets/talents/p3.talents.json';

// Preset options for this spec.
// Eventually we will import these values for the raid sim too, so its good to
// keep them in a separate file.

export const PRERAID_GEAR_PRESET = PresetUtils.makePresetGear('Pre-raid', PreraidGear);
export const P1_GEAR_PRESET = PresetUtils.makePresetGear('P1 - Default', P1Gear);
export const P2_GEAR_PRESET = PresetUtils.makePresetGear('P2 - Default', P2Gear);
export const P3_GEAR_PRESET = PresetUtils.makePresetGear('P3 - Default', P3Gear);
export const P4BiS_GEAR_PRESET = PresetUtils.makePresetGear('P4 - BiS', P4BiSGear);
export const P4P3U_GEAR_PRESET = PresetUtils.makePresetGear('P4 - P3 Upgraded', P4P3UpgradedGear);
export const P5_GEAR_PRESET = PresetUtils.makePresetGear('P5 - BiS', P5Gear);

export const ROTATION_PRESET_P5 = PresetUtils.makePresetAPLRotation('Default', P5Apl);
export const ROTATION_PRESET_CLEAVE = PresetUtils.makePresetAPLRotation('Cleave', CleaveApl);
export const ROTATION_PRESET_AOE = PresetUtils.makePresetAPLRotation('AoE (3+)', AoEApl);

// Preset options for EP weights
export const EP_PRESET_P3 = PresetUtils.makePresetEpWeightsFromJSON(EpP3Json);

export const EP_PRESET_P2 = PresetUtils.makePresetEpWeightsFromJSON(EpP2Json);

export const EP_PRESET_AOE = PresetUtils.makePresetEpWeightsFromJSON(EpAoeJson);

// Default talents. Uses the wowhead calculator format, make the talents on
// https://wowhead.com/mop-classic/talent-calc and copy the numbers in the url.
export const P2_TALENTS = PresetUtils.makePresetTalentsFromJSON(TalentsP2Json, { major: ShamanMajorGlyph });

export const P3_TALENTS = PresetUtils.makePresetTalentsFromJSON(TalentsP3Json, { major: ShamanMajorGlyph });

export const TalentsCleave = {
	name: 'Cleave',
	data: SavedTalents.create({
		talentsString: '333322',
		glyphs: Glyphs.create({
			...P3_TALENTS.data.glyphs,
		}),
	}),
};

export const TalentsAoE = {
	name: 'AoE (4+)',
	data: SavedTalents.create({
		...TalentsCleave.data,
		glyphs: Glyphs.create({
			...P3_TALENTS.data.glyphs,
			major2: ShamanMajorGlyph.GlyphOfChainLightning,
		}),
	}),
};

export const DefaultOptions = ElementalShamanOptions.create({
	classOptions: {
		shield: ShamanShield.LightningShield,
		feleAutocast: FeleAutocastSettings.create({
			autocastFireblast: true,
			autocastFirenova: true,
			autocastImmolate: true,
			autocastEmpower: false,
		}),
	},
});

export const OtherDefaults = {
	distanceFromTarget: 20,
	profession1: Profession.Engineering,
	profession2: Profession.Tailoring,
	race: Race.RaceTroll,
};

export const DefaultRaidBuffs = RaidBuffs.create({
	...defaultRaidBuffMajorDamageCooldowns(Class.ClassShaman),
	blessingOfKings: true,
	leaderOfThePack: true,
	serpentsSwiftness: true,
	bloodlust: true,
});

export const DefaultDebuffs = Debuffs.create({
	curseOfElements: true,
});

export const DefaultConsumables = ConsumesSpec.create({
	flaskId: 76085, // Flask of the Warm Sun
	foodId: 74650, // Mogu Fish Stew
	potId: 76093, // Potion of the Jade Serpent
	prepotId: 76093, // Potion of the Jade Serpent
});

const ENCOUNTER_SINGLE_TARGET = PresetUtils.makePresetEncounter('Single Target Dummy', Encounter.defaultEncounterProto());
const ENCOUNTER_CLEAVE = PresetUtils.makePresetEncounter('Cleave', Encounter.defaultEncounterProto(2));
const ENCOUNTER_AOE = PresetUtils.makePresetEncounter('AOE (4+)', Encounter.defaultEncounterProto(4));

export const PRESET_BUILD_CLEAVE = PresetUtils.makePresetBuild('Cleave', {
	talents: TalentsCleave,
	rotation: ROTATION_PRESET_CLEAVE,
	encounter: ENCOUNTER_CLEAVE,
	epWeights: EP_PRESET_P3,
});

export const PRESET_BUILD_AOE = PresetUtils.makePresetBuild('AoE (4+)', {
	talents: TalentsAoE,
	rotation: ROTATION_PRESET_AOE,
	encounter: ENCOUNTER_AOE,
	epWeights: EP_PRESET_AOE,
});

export const P5_PRESET_BUILD_DEFAULT = PresetUtils.makePresetBuild('P5 - BiS', {
	talents: P3_TALENTS,
	rotation: ROTATION_PRESET_P5,
	encounter: ENCOUNTER_SINGLE_TARGET,
	epWeights: EP_PRESET_P3,
	gear: P5_GEAR_PRESET,
});
