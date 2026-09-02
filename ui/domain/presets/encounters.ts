import { Encounter as EncounterProto, InputType, MobType } from '@core/proto/common';

import { Encounter } from '../encounter';

// Default single-target encounter proto shared by every class's preset list.
export const singleTargetEncounterProto = (): EncounterProto => Encounter.defaultEncounterProto();

// Malkorok (Siege of Orgrimmar) encounter proto. `duration`/`durationVariation`/`soakNumberValue`
// are left as parameters because the warrior and death knight presets currently ship different
// values on purpose (warrior: 144s/5s/100%; death knight: 300s/30s/0%, since AMS timing against
// Malkorok's magic damage needs the full fight) — reconciling them is a later, golden-changing PR.
export const malkorokEncounterProto = ({
	duration,
	durationVariation,
	soakNumberValue,
}: {
	duration: number;
	durationVariation: number;
	soakNumberValue: number;
}): EncounterProto =>
	EncounterProto.create({
		apiVersion: 3,
		duration,
		durationVariation,
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
						numberValue: soakNumberValue,
					},
				],
			},
		],
	});
