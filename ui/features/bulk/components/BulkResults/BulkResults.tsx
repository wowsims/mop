import i18n from '@i18n/config';

import { useBulkState } from '../../hooks/useBulkState';
import { BulkResultRow } from './BulkResultRow';

export const BulkResults = () => {
	const results = useBulkState(slice => slice.results);
	const started = useBulkState(slice => slice.started);

	if (!results) {
		// Starting a run empties the pane, so the invitation to run one does not come back.
		return started ? null : <div className="flex items-center justify-center p-6">{i18n.t('bulk_tab.results.run_simulation')}</div>;
	}

	const iterations = results.iterations;
	return (
		<>
			{results.chains.map((chain, chainIdx) =>
				chain.length > 1 ? (
					<div
						key={chainIdx}
						className="mb-6 flex flex-col rounded-md border border-l-3 border-border border-l-warning px-4 py-2"
						data-testid="bulk-results-tie-group">
						<span className="mb-6">{i18n.t('bulk_tab.results.tied_group')}</span>
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
