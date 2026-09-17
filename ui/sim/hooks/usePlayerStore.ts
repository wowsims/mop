import { useStore } from 'zustand';

import { usePlayer } from '../context/SimHostContext';
import type { PlayerSlice } from '../state/sim_store';

/** Not `PlayerField`: that is the version-*counter* list, which carries `rotation`/`itemSwap`/`epRefStat` and omits the six values the last two stand for. */
export type PlayerStoreField = keyof Omit<PlayerSlice, 'v'>;

/** The slice holds the values and `patchKeyed` replaces a reference only on a real change, so Zustand's identity check is the whole subscription — no counter, no snapshot cache, no read callback. */
export const usePlayerStore = <F extends PlayerStoreField>(field: F): PlayerSlice[F] => {
	const player = usePlayer();
	// `?.` covers the window between Player.dispose() and its deferred deleteKeyed, when a still-mounted selector meets a missing slice.
	return useStore(player.sim.store, s => s.players[player.storeKey]?.[field]);
};
