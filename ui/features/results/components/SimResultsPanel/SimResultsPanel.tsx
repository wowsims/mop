import type { SimResultsManager } from '@features/results/model/results_manager';
import type { WarningsRegistry } from '@features/results/model/warnings';
import { useSimHost } from '@sim/context/SimHostContext';
import { useSimReady } from '@sim/hooks/useSimReady';
import { Spinner } from '@ui-kit/Spinner';
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
		<div data-testid="results-viewer">
			<div
				className="[&_.ui-spinner]:m-auto"
				data-testid="results-pending"
				hidden={stage !== ResultsPanelStage.Pending && stage !== ResultsPanelStage.Running}>
				{stage === ResultsPanelStage.Running ? <SimProgress panel={panel} /> : <Spinner />}
			</div>
			<div data-testid="results-content" hidden={stage !== ResultsPanelStage.Result}>
				{results && <SimResultSummary results={results} />}
			</div>
			<div className="text-center" data-testid="button-zone" hidden={!buttonsVisible}>
				{abortHandler && <AbortButton onAbort={abortHandler} />}
			</div>
			<SimWarnings warnings={warnings} ready={ready} />
			{host.disabled && <UnlaunchedNotice isHealingSpec={host.player.getPlayerSpec().isHealingSpec} />}
		</div>
	);
};
