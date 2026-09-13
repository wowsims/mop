import type { ProgressMetrics } from '@generated/proto/api';
import i18n from '@i18n/config';
import { useSimHost } from '@sim/context/SimHostContext';
import { SimRunKind } from '@sim/state/sim_store';
import { SidebarActionButton } from '@ui-kit/SidebarActionButton';
import { useRef, useState } from 'react';

import { trackEvent } from '../../../tracking/analytics';

export const SimulateAction = () => {
	const host = useSimHost();
	const runs = host.sim.runs;
	const [disabled, setDisabled] = useState(false);
	// Not `runs.isAborting`: that tracks the kind's run, which the facade clears as the run settles,
	// while this tracks whether *this click's* abort is still in flight. Substituting one for the
	// other leaves the button disabled and the Stop zone up after the next run completes.
	const waitAbort = useRef(false);

	const simulate = async () => {
		trackEvent({
			action: 'sim',
			category: 'simulate',
			label: 'simulate',
			value: host.sim.getIterations(),
		});
		setDisabled(true);
		if (runs.isRunning(SimRunKind.IndividualSim)) return;

		host.resultsViewer.addAbortButton(async () => {
			if (waitAbort.current) return;
			try {
				waitAbort.current = true;
				await runs.abort(SimRunKind.IndividualSim);
			} catch (error) {
				console.error('Error on sim abort!');
				console.error(error);
			} finally {
				waitAbort.current = false;
				if (!runs.isRunning(SimRunKind.IndividualSim)) setDisabled(false);
			}
		});

		await host.runIndividualSim((progress: ProgressMetrics) => {
			if (progress.finalRaidResult?.error) {
				host.resultsViewer.hideAll();
				return;
			}
			host.resultsViewer.setProgress(progress);
		});

		host.resultsViewer.removeAbortButton();
		if (!waitAbort.current) setDisabled(false);
	};

	return (
		<SidebarActionButton className="dps-action" disabled={disabled} onClick={() => void simulate()}>
			{i18n.t('sidebar.buttons.simulate')}
		</SidebarActionButton>
	);
};
