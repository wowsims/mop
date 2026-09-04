import type { Player } from '@domain/player';
import type { RogueSpecs } from '@domain/proto_utils/utils';
import { subscribeAll, subscribeEncounterChange, subscribePlayerChange } from '@domain/state/subscriptions';
import type { DerivedSetting } from '@features/spec_config';
import { RogueOptions_PoisonOptions } from '@generated/proto/rogue';

// Unless the user opted into applying poisons manually, the lethal poison is
// pinned to Deadly Poison. All three rogue specs installed the identical pair of
// subscriptions (player change + encounter change) in their old constructors.
//
// Declared as `DerivedSetting<any>` because `Player<S>` is invariant in `S`, so
// a rule typed against the rogue spec union would not be assignable into any one
// spec's `derivedSettings`. The callback bodies are still checked against
// `RogueSpecs`.
export const lethalPoisonRule: DerivedSetting<any> = {
	subscribe: (player, sim) => subscribeAll([subscribePlayerChange(player), subscribeEncounterChange(sim.encounter)]),
	apply: (player: Player<RogueSpecs>) => {
		const options = player.getSpecOptions();
		if (!options.classOptions!.applyPoisonsManually) {
			options.classOptions!.lethalPoison = RogueOptions_PoisonOptions.DeadlyPoison;
		}
		player.setSpecOptions(options);
	},
};
