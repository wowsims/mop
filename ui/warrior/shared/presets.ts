import * as PresetUtils from '@app/preset_utils';
import { Class, RaidBuffs } from '@core/proto/common';
import { malkorokEncounterProto, singleTargetEncounterProto } from '@domain/presets/encounters';
import { defaultRaidBuffMajorDamageCooldowns } from '@domain/proto_utils/utils';

// Shared by the arms and fury DPS specs; protection tanks want a different mix.
export const DefaultRaidBuffs = RaidBuffs.create({
	...defaultRaidBuffMajorDamageCooldowns(Class.ClassWarrior),
	legacyOfTheEmperor: true,
	legacyOfTheWhiteTiger: true,
	darkIntent: true,
	trueshotAura: true,
	unleashedRage: true,
	moonkinAura: true,
	blessingOfMight: true,
	bloodlust: true,
});

export const ENCOUNTER_SINGLE_TARGET = PresetUtils.makePresetEncounter('Default', singleTargetEncounterProto());
export const ENCOUNTER_MALKOROK = PresetUtils.makePresetEncounter(
	'Malkorok',
	malkorokEncounterProto({ duration: 144, durationVariation: 5, soakNumberValue: 100 }),
);
