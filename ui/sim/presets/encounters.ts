import { Encounter as EncounterProto, InputType, MobType } from '@generated/proto/common';

import { ENCOUNTER_DEFAULTS } from '../constants/encounter';
import { Encounter } from '../encounter';

// Default single-target encounter proto shared by every class's preset list.
export const singleTargetEncounterProto = (): EncounterProto => Encounter.defaultEncounterProto();

// Malkorok (Siege of Orgrimmar) encounter proto. `duration`/`durationVariation`/`soakNumberValue`
// are left as parameters because the warrior and death knight presets currently ship different
// values on purpose (warrior: 144s/5s/100%; death knight: 300s/30s/0%, since AMS timing against
// Malkorok's magic damage needs the full fight) — reconciling them is a later, golden-changing PR.
// `soakTooltip` comes with them: each preset has to describe the soak value it actually ships,
// not the sim's own 36% default (sim/encounters/soo/malkorok_ai.go).
export const malkorokEncounterProto = ({
	duration,
	durationVariation,
	soakNumberValue,
	soakTooltip,
}: {
	duration: number;
	durationVariation: number;
	soakNumberValue: number;
	soakTooltip: string;
}): EncounterProto =>
	EncounterProto.create({
		...ENCOUNTER_DEFAULTS,
		apiVersion: 3,
		duration,
		durationVariation,
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
						tooltip: soakTooltip,
						numberValue: soakNumberValue,
					},
				],
			},
		],
	});
