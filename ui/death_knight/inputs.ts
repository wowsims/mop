// Configuration for spec-specific UI elements on the settings tab.
// These don't need to be in a separate file but it keeps things cleaner.

import { Player } from '@domain/player';
import { Sim } from '@domain/sim';
import { EventID } from '@domain/state/batch';

import { Spec } from '../core/proto/common';
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
