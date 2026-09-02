import { Player } from '@domain/player';
import { Sim } from '@domain/sim';
import { EventID } from '@domain/state/batch';
import { subscribeAll, subscribeEncounterChange, subscribePlayerField } from '@domain/state/subscriptions';
import * as InputHelpers from '@ui-kit/input_helpers';

import { Spec } from '../../core/proto/common';

// Configuration for spec-specific UI elements on the settings tab.
// These don't need to be in a separate file but it keeps things cleaner.

// NPC IDs of encounters whose AI casts real magic damage at raid players, so Anti-Magic
// Shell already absorbs it through the normal path and generates Runic Power from it. Keep
// this in sync with the boss AI types checked by DeathKnight.disableAMSIntakeOnMagicDamageEncounters
// in sim/death_knight/death_knight.go.
const MAGIC_DAMAGE_ENCOUNTER_NPC_IDS = [
	71454, // Malkorok (Siege of Orgrimmar)
	71466, // Iron Juggernaut (Siege of Orgrimmar)
	60143, // Gara'jal the Spiritbinder (Mogu'shan Vaults)
];

export const encounterModelsMagicDamage = (sim: Sim): boolean => sim.encounter.getTargets().some(target => MAGIC_DAMAGE_ENCOUNTER_NPC_IDS.includes(target.id));

// Zeroes the abstract AMS intake settings whenever the selected encounter already deals
// real magic damage, so a value configured for a different encounter can't silently keep
// applying (the sim ignores it either way, but a stale nonzero value stored in settings/share
// links is misleading to anyone reading them later).
export function disableAMSIntakeOnMagicDamageEncounters<SpecType extends Spec.SpecFrostDeathKnight | Spec.SpecUnholyDeathKnight>(
	eventID: EventID,
	player: Player<SpecType>,
) {
	if (!encounterModelsMagicDamage(player.sim)) return;

	const options = player.getSpecOptions();
	if (!options.avgAmsHit && !options.avgAmsSuccessRate && !options.amsNumTicks) return;

	options.avgAmsHit = 0;
	options.avgAmsSuccessRate = 0;
	options.amsNumTicks = 0;
	player.setSpecOptions(eventID, options);
}

type AMSIntakeSpecs = Spec.SpecFrostDeathKnight | Spec.SpecUnholyDeathKnight;

// The AMS intake settings are ignored by the sim on encounters that cast real magic damage
// at the raid, so hide them there rather than leaving inputs that do nothing. Visibility is
// re-evaluated on encounter changes as well as the usual spec options one.
const showWhenAMSIntakeUsed = (player: Player<AMSIntakeSpecs>) => !encounterModelsMagicDamage(player.sim);
const amsIntakeSubscribe = (player: Player<any>) => subscribeAll([subscribePlayerField(player, 'specOptions'), subscribeEncounterChange(player.sim.encounter)]);

export const AvgAMSHitInput = InputHelpers.makeSpecOptionsNumberInput<AMSIntakeSpecs>({
	fieldName: 'avgAmsHit',
	label: 'Avg AMS Hit',
	labelTooltip: 'How much on average (+-10%) the character is hit for when AMS is successful. Set to 0 to disable AMS damage intake.',
	showWhen: showWhenAMSIntakeUsed,
	storeSubscribe: amsIntakeSubscribe,
});

export const AvgAMSSuccessRateInput = InputHelpers.makeSpecOptionsNumberInput<AMSIntakeSpecs>({
	fieldName: 'avgAmsSuccessRate',
	label: 'Avg AMS Success %',
	labelTooltip: 'Chance for damage to be taken during the 5 second window of AMS.',
	percent: true,
	showWhen: showWhenAMSIntakeUsed,
	storeSubscribe: amsIntakeSubscribe,
});

export const AMSNumTicksInput = InputHelpers.makeSpecOptionsEnumInput<AMSIntakeSpecs, number>({
	fieldName: 'amsNumTicks',
	label: 'AMS Damage Ticks',
	labelTooltip:
		'Number of magic hits taken per AMS window — 1 lands at a random time, 2+ are evenly spaced. Each tick independently rolls Avg AMS Success %.',
	values: [
		{ name: '1', value: 1 },
		{ name: '2', value: 2 },
		{ name: '3', value: 3 },
		{ name: '4', value: 4 },
		{ name: '5', value: 5 },
	],
	// Old saved settings predate this field and deserialize to 0; show them as 1 tick.
	getValue: player => player.getSpecOptions().amsNumTicks || 1,
	showWhen: showWhenAMSIntakeUsed,
	storeSubscribe: amsIntakeSubscribe,
});
