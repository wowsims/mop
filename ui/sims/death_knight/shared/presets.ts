import * as PresetUtils from '@app/preset_utils';
import { RaidBuffs } from '@core/proto/common';
import { malkorokEncounterProto, singleTargetEncounterProto } from '@domain/presets/encounters';
import { defaultRaidBuffMajorDamageCooldowns } from '@domain/proto_utils/utils';

// Shared by the frost and unholy DPS specs; blood tanks want a different mix.
export const DefaultRaidBuffs = RaidBuffs.create({
	...defaultRaidBuffMajorDamageCooldowns(),
	blessingOfKings: true,
	blessingOfMight: true,
	bloodlust: true,
	elementalOath: true,
	leaderOfThePack: true,
	trueshotAura: true,
	unholyAura: true,
});

export const ENCOUNTER_SINGLE_TARGET = PresetUtils.makePresetEncounter('Default', singleTargetEncounterProto());

// Default encounter for the DPS DK sims: Anti-Magic Shell timing against Malkorok's
// magic damage is a core part of the rotation, so sim it by default. Imploding Energy
// Soak % defaults to 0, modeling a DK who isn't assigned to soak it; raise it to match
// your raid's assignments.
export const ENCOUNTER_MALKOROK = PresetUtils.makePresetEncounter(
	'Malkorok',
	malkorokEncounterProto({
		duration: 300,
		durationVariation: 30,
		soakNumberValue: 0,
		soakTooltip:
			"Percentage of Imploding Energy batches this player soaks. This preset ships 0%, modelling a death knight who isn't assigned to soak; raise it to match your raid assignments — the reference log has ~9 of 25 players hit per batch, i.e. 36%.",
	}),
);
