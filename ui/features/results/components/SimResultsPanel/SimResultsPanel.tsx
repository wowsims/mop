import './SimResultsPanel.scss';

import { useSimHost } from '@sim/context/SimHostContext';
import { useSimReady } from '@sim/hooks/useSimReady';
import type { SimResultsManager } from '@features/results/model/results_manager';
import type { WarningsRegistry } from '@features/results/model/warnings';
import { useSyncExternalStore } from 'react';

import { AbortButton } from './AbortButton';
import { ResultsPanelStage, type ResultsPanelStore } from './results_panel_store';
import { SimProgress } from './SimProgress';
import { SimResultSummary } from './SimResultSummary';
import { SimWarnings } from './SimWarnings';
import { UnlaunchedNotice } from './UnlaunchedNotice';

export interface SimResultsPanelProps {
	panel: ResultsPanelStore;
	warnings: WarningsRegistry;
	results: SimResultsManager | null;
}

export const SimResultsPanel = ({ panel, warnings, results }: SimResultsPanelProps) => {
	const host = useSimHost();
	const ready = useSimReady();
	const stage = useSyncExternalStore(panel.subscribe, panel.getStage);
	const abortHandler = useSyncExternalStore(panel.subscribe, panel.getAbortHandler);
	const buttonsVisible = useSyncExternalStore(panel.subscribe, panel.getButtonsVisible);

	return (
		<div className="results-viewer">
			<div className="results-pending" hidden={stage !== ResultsPanelStage.Pending && stage !== ResultsPanelStage.Running}>
				{stage === ResultsPanelStage.Running ? <SimProgress panel={panel} /> : <div className="loader" />}
			</div>
			<div className="results-content" hidden={stage !== ResultsPanelStage.Result}>
				{results && <SimResultSummary results={results} />}
			</div>
			<div className="button-zone text-center" hidden={!buttonsVisible}>
				{abortHandler && <AbortButton onAbort={abortHandler} />}
			</div>
			<SimWarnings warnings={warnings} ready={ready} />
			{host.disabled && <UnlaunchedNotice isHealingSpec={host.player.getPlayerSpec().isHealingSpec} />}
		</div>
	);
};
