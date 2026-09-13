import { usePlayer } from '@sim/context/SimHostContext';
import { useEffect, useState } from 'react';

import type { BulkProgress } from '../model/progress';
import { bulkProgress, subscribeBulkProgress } from '../model/run';

export const useBulkProgress = (): BulkProgress | null => {
	const player = usePlayer();
	const [progress, setProgress] = useState<BulkProgress | null>(() => bulkProgress(player));

	useEffect(() => subscribeBulkProgress(player, setProgress), [player]);

	return progress;
};
