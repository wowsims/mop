import { useSimHost } from '@sim/context/SimHostContext';
import { ProgressTrackerDialog } from '@ui-kit/ProgressTrackerDialog';
import type { ProgressTrackerHandle } from '@ui-kit/ProgressTrackerDialog';
import { useEffect, useRef, useState } from 'react';

import { cancelBulkBatch, subscribeBulkProgress } from '../../model/run';
import { BulkProgressMessage } from './BulkProgressMessage';

/** One element, so the dialog's own state changes only when the stage does. */
const MESSAGE = <BulkProgressMessage />;

/** Mounted only while a batch is in flight, the way the reforge tracker is: at rest there is nothing here. */
export const BulkProgressDialog = () => {
	const host = useSimHost();

	const [state, setState] = useState({ stage: 'preparing', hasMessage: false });
	const barRef = useRef<ProgressTrackerHandle>(null);

	useEffect(
		() =>
			subscribeBulkProgress(host.player, progress => {
				const hasMessage = progress.secondsRemaining !== undefined || !!progress.iterations;
				setState(previous =>
					previous.stage === progress.stage && previous.hasMessage === hasMessage ? previous : { stage: progress.stage, hasMessage },
				);
				barRef.current?.setProgress({ title: progress.title, current: progress.current, total: progress.total });
			}),
		[host],
	);

	return (
		<ProgressTrackerDialog
			open
			container={host.rootElem}
			className="bulk-sim-progress-tracker"
			title="Bulk Sim"
			state={{ stage: state.stage, message: state.hasMessage ? MESSAGE : undefined }}
			hasProgressBar
			onCancel={() => void cancelBulkBatch(host)}
			ref={barRef}
		/>
	);
};
