import { formatDurationSeconds } from '@sim/utils/format';
import i18n from '@i18n/config';
import { useEffect, useState } from 'react';

import { useBulkTab } from '../../hooks/useBulkTab';
import type { BulkProgress } from '../../model/progress';

/** Subscribes to the run's own ticks, so a progress message commits this leaf and never the dialog. */
export const BulkProgressMessage = () => {
	const bt = useBulkTab();
	const [progress, setProgress] = useState<BulkProgress | null>(bt.getProgress);

	useEffect(() => bt.onProgress(setProgress), [bt]);

	if (!progress) return null;
	const remaining = progress.secondsRemaining !== undefined && (
		<div>{i18n.t('bulk_tab.progress.time_remaining', { time: formatDurationSeconds(progress.secondsRemaining) })}</div>
	);
	if (!progress.iterations) return remaining || null;

	return (
		<div className="results-sim">
			<div
				dangerouslySetInnerHTML={{
					__html: i18n.t('bulk_tab.progress.iterations_complete', {
						completed: progress.iterations.completed,
						total: progress.iterations.total,
					}),
				}}
			/>
			{remaining}
		</div>
	);
};
