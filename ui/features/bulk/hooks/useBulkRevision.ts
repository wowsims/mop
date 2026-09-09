import { useSyncExternalStore } from 'react';

import { useBulkTab } from './useBulkTab';

/** The run flag, the results and the combination count — the three the bulk store slice does not carry. */
export const useBulkRevision = (): number => {
	const bt = useBulkTab();
	return useSyncExternalStore(bt.subscribe, bt.getRevision, bt.getRevision);
};
