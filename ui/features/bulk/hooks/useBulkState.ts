import type { BulkSlice } from '@sim/state/sim_store';
import { useStore } from 'zustand';

import { useBulkTab } from './useBulkTab';

export const useBulkState = <T>(selector: (slice: BulkSlice) => T): T => {
	const bt = useBulkTab();
	return useStore(bt.sim.store, state => selector(state.bulk[bt.storeKey]));
};
