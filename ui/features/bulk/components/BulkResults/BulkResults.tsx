import './BulkResults.scss';

import { useSim } from '@sim/context/SimHostContext';
import i18n from '@i18n/config';

import { useBulkRevision } from '../../hooks/useBulkRevision';
import { useBulkTab } from '../../hooks/useBulkTab';
import { BulkResultRow } from './BulkResultRow';

export const BulkResults = () => {
	const bt = useBulkTab();
	const sim = useSim();
	useBulkRevision();

	const results = bt.getResults();
	if (!results) {
		// Starting a run empties the pane, so the invitation to run one does not come back.
		return bt.hasStarted() ? null : (
			<div className="d-flex align-items-center justify-content-center p-gap">{i18n.t('bulk_tab.results.run_simulation')}</div>
		);
	}

	const iterations = Math.max(1, sim.getIterations());
	return (
		<>
			{results.chains.map((chain, chainIdx) =>
				chain.length > 1 ? (
					<div key={chainIdx} className="bulk-results-tie-group">
						<span className="mb-4">{i18n.t('bulk_tab.results.tied_group')}</span>
						{chain.map((result, idx) => (
							<BulkResultRow key={idx} result={result} baseResult={results.originalGearResults} iterations={iterations} />
						))}
					</div>
				) : (
					<BulkResultRow key={chainIdx} result={chain[0]} baseResult={results.originalGearResults} iterations={iterations} />
				),
			)}
		</>
	);
};
