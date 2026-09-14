import type { ProgressMetrics } from '@generated/proto/api';
import i18n from '@i18n/config';
import { useSim } from '@sim/context/SimHostContext';
import { useDisplayMetrics } from '@sim/hooks/useDisplayMetrics';
import { useLayoutEffect, useRef } from 'react';

import type { ResultsPanelStore } from './results_panel_store';

export interface SimProgressProps {
	panel: ResultsPanelStore;
}

/** The three numbers are `textContent` writes off the store's progress listener, never renders: the callback fires up to ten times a second. */
export const SimProgress = ({ panel }: SimProgressProps) => {
	const { damage: showDamage, healing: showHealing } = useDisplayMetrics(useSim());
	const dps = useRef<HTMLSpanElement>(null);
	const hps = useRef<HTMLSpanElement>(null);
	const counter = useRef<HTMLSpanElement>(null);

	useLayoutEffect(() => {
		const write = (progress: ProgressMetrics) => {
			if (dps.current) dps.current.textContent = progress.dps.toFixed(2);
			if (hps.current) hps.current.textContent = progress.hps.toFixed(2);
			if (counter.current) {
				counter.current.textContent = progress.presimRunning
					? i18n.t('sidebar.results.progress.presim_running')
					: `${progress.completedIterations} / ${progress.totalIterations}`;
			}
		};
		// The tick that mounted this block carried the first numbers; without this read the panel stays blank until tick two.
		if (panel.latestProgress) write(panel.latestProgress);
		return panel.onProgress(write);
	}, [panel]);

	return (
		<div data-testid="results-sim" className="text-center">
			{showDamage && (
				<div data-testid="results-sim-dps" className="font-bold">
					<span ref={dps} data-testid="topline-result-avg" className="text-2xl" />
				</div>
			)}
			{showHealing && (
				<div className="font-bold" data-testid="results-sim-hps">
					<span ref={hps} data-testid="topline-result-avg" className="text-2xl" />
				</div>
			)}
			<div>
				<span ref={counter} />
				<br />
				{i18n.t('sidebar.results.progress.iterations_complete')}
			</div>
		</div>
	);
};
