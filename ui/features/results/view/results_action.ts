import type { SimHost } from '@sim/sim_host';
import { SimRunKind } from '@sim/state/sim_store';
import { SimResultsManager } from '@features/results/model/results_manager';
import type { ProgressMetrics } from '@generated/proto/api';
import i18n from '@i18n/config';

import { trackEvent } from '../../../tracking/analytics';

export function addSimResultsAction(simUI: SimHost): SimResultsManager {
	const resultsViewer = simUI.resultsViewer;
	const runs = simUI.sim.runs;
	// Not `runs.isAborting`: that tracks the kind's run, which the facade clears as the run settles,
	// while this tracks whether *this click's* abort is still in flight. Substituting one for the
	// other leaves the button disabled and the Stop zone up after the next run completes.
	let waitAbort = false;

	simUI.addAction(i18n.t('sidebar.buttons.simulate'), 'dps-action', async ev => {
		trackEvent({
			action: 'sim',
			category: 'simulate',
			label: 'simulate',
			value: simUI.sim.getIterations(),
		});
		const button = ev.target as HTMLButtonElement;
		button.disabled = true;
		if (!runs.isRunning(SimRunKind.IndividualSim)) {
			resultsViewer.addAbortButton(async () => {
				if (waitAbort) return;
				try {
					waitAbort = true;
					await runs.abort(SimRunKind.IndividualSim);
				} catch (error) {
					console.error('Error on sim abort!');
					console.error(error);
				} finally {
					waitAbort = false;
					if (!runs.isRunning(SimRunKind.IndividualSim)) button.disabled = false;
				}
			});

			await simUI.runIndividualSim((progress: ProgressMetrics) => {
				if (progress.finalRaidResult?.error) {
					resultsViewer.hideAll();
					return;
				}
				resultsViewer.setProgress(progress);
			});

			resultsViewer.removeAbortButton();
			if (!waitAbort) button.disabled = false;
		}
	});

	const resultsManager = new SimResultsManager(simUI.sim);
	simUI.sim.simResultEmitter.on(simResult => {
		// The result before the stage: `showResult` notifies through `flushSync`, so flipping the stage
		// first would commit the result zone while it was still empty.
		resultsManager.setSimResult(simResult);
		resultsViewer.showResult();
	});
	return resultsManager;
}
