import { useStore } from 'zustand';

import { useBulkTab } from './useBulkTab';

/** The bulk slice's version counter, which is the tab's one write path for its own state. */
export const useBulkVersion = (field: 'settings' | 'items'): number => {
	const bt = useBulkTab();
	return useStore(bt.sim.store, state => state.bulk[bt.storeKey]?.v[field] ?? 0);
};
