import type { Player } from '@domain/player';
import type { Sim } from '@domain/sim';
import { subscribePlayerChange } from '@domain/state/subscriptions';
import { Spec } from '@generated/proto/common';

// Monks' dummy count is talent-driven (sims/monk/shared/derived.ts), so the rule below is not theirs to apply — their picker is hidden and the count is set for them.
const TALENT_DRIVEN = [Spec.SpecBrewmasterMonk, Spec.SpecWindwalkerMonk];

/** The target-dummy count is the raid's, but whether it may be non-zero is the player's business — a talent or an item swap can take the ability away, and the count has to follow. */
export const watchTargetDummies = (player: Player<any>, sim: Sim): void => {
	if (!player.canEnableTargetDummies() || TALENT_DRIVEN.includes(player.getSpec())) return;
	subscribePlayerChange(player)(() => {
		if (!player.shouldEnableTargetDummies() && sim.raid.getTargetDummies() !== 0) sim.raid.setTargetDummies(0);
	});
};
