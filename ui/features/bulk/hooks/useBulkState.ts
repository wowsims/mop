import { usePlayer } from '@sim/context/SimHostContext';
import type { BulkSlice } from '@sim/state/sim_store';
import { useStore } from 'zustand';

export const useBulkState = <T>(selector: (slice: BulkSlice) => T): T => {
	const player = usePlayer();
	return useStore(player.sim.store, state => selector(state.bulk[player.storeKey]));
};
