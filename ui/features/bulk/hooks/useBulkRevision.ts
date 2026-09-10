import { useStore } from 'zustand';

import { useBulkTab } from './useBulkTab';

export const useBulkRevision = () => {
	const bt = useBulkTab();
	return useStore(bt.sim.store, state => state.bulk[bt.storeKey]);
};
