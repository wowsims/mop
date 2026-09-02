import * as PresetUtils from '@app/preset_utils';
import { ConsumesSpec, Debuffs, Profession, RaidBuffs } from '@core/proto/common';
import {
	HolyPaladin_Options as Paladin_Options,
	PaladinMajorGlyph as MajorGlyph,
	PaladinSeal,
} from '@core/proto/paladin';
import { defaultRaidBuffMajorDamageCooldowns } from '@domain/proto_utils/utils';

import P1Gear from './gear_sets/p1.gear.json';
import P1EpJson from './presets/ep/p1.ep.json';
import StandardTalentsJson from './presets/talents/standard.talents.json';

// Preset options for this spec.
// Eventually we will import these values for the raid sim too, so its good to
// keep them in a separate file.

export const P1_GEAR_PRESET = PresetUtils.makePresetGear('P1 Preset', P1Gear);

// Preset options for EP weights
export const P1_EP_PRESET = PresetUtils.makePresetEpWeightsFromJSON(P1EpJson);

// Default talents. Uses the wowhead calculator format, make the talents on
// https://wowhead.com/mop-classic/talent-calc and copy the numbers in the url.

export const StandardTalents = PresetUtils.makePresetTalentsFromJSON(StandardTalentsJson, { major: MajorGlyph });

export const DefaultOptions = Paladin_Options.create({
	classOptions: {
		seal: PaladinSeal.Insight,
	},
});

export const DefaultRaidBuffs = RaidBuffs.create({
	...defaultRaidBuffMajorDamageCooldowns()
});

export const DefaultConsumables = ConsumesSpec.create({
	flaskId: 58086, // Flask of the Draconic Mind
	foodId: 62290, // Seafood Magnifique Feast
	potId: 58091, // Volcanic Potion
});

export const DefaultDebuffs = Debuffs.create({
	// bloodFrenzy: true,
	// sunderArmor: true,
	// ebonPlaguebringer: true,
	// mangle: true,
	// criticalMass: true,
	// demoralizingShout: true,
	// frostFever: true,
});

export const OtherDefaults = {
	distanceFromTarget: 40,
	profession1: Profession.Engineering,
	profession2: Profession.Jewelcrafting,
};
