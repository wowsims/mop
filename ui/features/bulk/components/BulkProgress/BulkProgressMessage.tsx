import { formatDurationSeconds } from '@sim/utils/format';
import i18n from '@i18n/config';
import { Trans } from 'react-i18next';

import { useBulkProgress } from '../../hooks/useBulkProgress';

/** Subscribes to the run's own ticks, so a progress message commits this leaf and never the dialog. */
export const BulkProgressMessage = () => {
	const progress = useBulkProgress();

	if (!progress) return null;
	const remaining = progress.secondsRemaining !== undefined && (
		<div>{i18n.t('bulk_tab.progress.time_remaining', { time: formatDurationSeconds(progress.secondsRemaining) })}</div>
	);
	if (!progress.iterations) return remaining || null;

	return (
		<div className="results-sim">
			<div>
				<Trans
					i18n={i18n}
					i18nKey="bulk_tab.progress.iterations_complete"
					values={{ completed: progress.iterations.completed, total: progress.iterations.total }}
				/>
			</div>
			{remaining}
		</div>
	);
};
