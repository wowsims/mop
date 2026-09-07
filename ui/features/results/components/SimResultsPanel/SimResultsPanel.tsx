import './SimResultsPanel.scss';

import type { WarningsRegistry } from '@features/results/model/warnings';
import { useSimHost } from '@features/SimHostContext';
import { useCallback, useSyncExternalStore } from 'react';

import { AbortButton } from './AbortButton';
import type { ResultsPanelStore } from './results_panel_store';
import { SimProgress } from './SimProgress';
import { SimWarnings } from './SimWarnings';
import { UnlaunchedNotice } from './UnlaunchedNotice';

export interface SimResultsPanelProps {
	panel: ResultsPanelStore;
	warnings: WarningsRegistry;
}

/** `.results-content` must never be given a React child: `SimResultsManager` writes the finished topline into it with `replaceChildren`, and React leaves a node's foreign children alone only while its own child list stays null. */
export const SimResultsPanel = ({ panel, warnings }: SimResultsPanelProps) => {
	const host = useSimHost();
	const stage = useSyncExternalStore(panel.subscribe, panel.getStage);
	const abortHandler = useSyncExternalStore(panel.subscribe, panel.getAbortHandler);
	const buttonsVisible = useSyncExternalStore(panel.subscribe, panel.getButtonsVisible);

	const contentRef = useCallback(
		(elem: HTMLDivElement | null) => {
			panel.contentElem = elem;
		},
		[panel],
	);

	return (
		<div className="results-viewer">
			<div className="results-pending" hidden={stage !== 'pending' && stage !== 'running'}>
				{stage === 'running' ? <SimProgress panel={panel} /> : <div className="loader" />}
			</div>
			<div ref={contentRef} className="results-content" hidden={stage !== 'result'} />
			<div className="button-zone text-center" hidden={!buttonsVisible}>
				{abortHandler && <AbortButton onAbort={abortHandler} />}
			</div>
			<SimWarnings warnings={warnings} />
			{host.disabled && <UnlaunchedNotice isHealingSpec={host.player.getPlayerSpec().isHealingSpec} />}
		</div>
	);
};
