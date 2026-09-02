import * as PresetUtils from '@app/preset_utils';
import { Encounter } from '@domain/encounter';

import { Encounter as EncounterProto, InputType, MobType } from '../core/proto/common';

export const ENCOUNTER_SINGLE_TARGET = PresetUtils.makePresetEncounter('Default', Encounter.defaultEncounterProto());

// Default encounter for the DPS DK sims: Anti-Magic Shell timing against Malkorok's
// magic damage is a core part of the rotation, so sim it by default. Imploding Energy
// Soak % defaults to 0, modeling a DK who isn't assigned to soak it; raise it to match
// your raid's assignments.
export const ENCOUNTER_MALKOROK = PresetUtils.makePresetEncounter(
	'Malkorok',
	EncounterProto.create({
		apiVersion: 3,
		duration: 300,
		durationVariation: 30,
		executeProportion20: 0.2,
		executeProportion25: 0.25,
		executeProportion35: 0.35,
		executeProportion45: 0.45,
		executeProportion90: 0.9,
		targets: [
			{
				id: 71454,
				name: 'Malkorok (DPS) 25 H',
				level: 93,
				mobType: MobType.MobTypeHumanoid,
				stats: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 24835, 0, 900000000, 0, 0],
				minBaseDamage: 250000,
				damageSpread: 0.5,
				swingSpeed: 2,
				targetInputs: [
					{
						inputType: InputType.Number,
						label: 'Imploding Energy Soak %',
						tooltip:
							"Percentage of Imploding Energy batches this player soaks. The default 36% matches the ~9 of 25 players hit per batch in the reference log; raise it if you're always assigned to soak, lower it if you rarely are.",
						numberValue: 0,
					},
				],
			},
		],
	}),
);
