import type { Player } from '@domain/player';
import { subscribeEncounterChange } from '@domain/state/subscriptions';
import type { DerivedSetting } from '@features/spec_config';

import type { Spec } from '../../core/proto/common';
import { disableAMSIntakeOnMagicDamageEncounters } from '../inputs';

// The abstract AMS intake settings are zeroed on encounters that already deal real
// magic damage. Both DPS death knight constructors applied this once and re-applied
// it on every encounter change.
//
// Declared as `DerivedSetting<any>` because `Player<S>` is invariant in `S`, so a
// rule typed against the death knight spec union would not be assignable into any
// one spec's `derivedSettings`. The callback body is still checked against the union.
export const amsIntakeRule: DerivedSetting<any> = {
	subscribe: (_player, sim) => subscribeEncounterChange(sim.encounter),
	apply: (eventID, player: Player<Spec.SpecFrostDeathKnight | Spec.SpecUnholyDeathKnight>) => disableAMSIntakeOnMagicDamageEncounters(eventID, player),
};
