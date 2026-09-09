import { useSimHost } from '@sim/context/SimHostContext';

import type { BulkTab } from '../bulk_tab';

/** Every bulk component renders under `BulkTabBody`, which only exists once the tab has been built. */
export const useBulkTab = (): BulkTab => {
	const bt = useSimHost().bt;
	if (!bt) throw new Error('useBulkTab called outside the bulk tab');
	return bt;
};
