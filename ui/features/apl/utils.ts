import type { Player } from '@sim/player/player';
import { subscribePlayerField } from '@sim/state/subscriptions';

/**
 * The change source every APL picker has: the player's rotation.
 *
 * It is not optional. `useStoreSubscribe` only re-reads `getValue` when its source notifies, so a
 * bound leaf handed a config without a `storeSubscribe` renders once and then freezes at that
 * value — silently, with no error and no visual cue.
 */
export const rotationSource = (player: Player<any>) => subscribePlayerField(player, 'rotation');
