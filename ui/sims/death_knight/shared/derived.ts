import type { Player } from '@domain/player';
import type { DerivedSetting } from '@domain/spec_config';
import { subscribeEncounterChange } from '@domain/state/subscriptions';
import type { Spec } from '@generated/proto/common';

import { disableAMSIntakeOnMagicDamageEncounters } from './inputs';

// The abstract AMS intake settings are zeroed on encounters that already deal real
// magic damage. Both DPS death knight constructors applied this once and re-applied
// it on every encounter change.
//
// Declared as `DerivedSetting<any>` because `Player<S>` is invariant in `S`, so a
// rule typed against the death knight spec union would not be assignable into any
// one spec's `derivedSettings`. The callback body is still checked against the union.
export const amsIntakeRule: DerivedSetting<any> = {
	subscribe: (_player, sim) => subscribeEncounterChange(sim.encounter),
	apply: (player: Player<Spec.SpecFrostDeathKnight | Spec.SpecUnholyDeathKnight>) => disableAMSIntakeOnMagicDamageEncounters(player),
};
