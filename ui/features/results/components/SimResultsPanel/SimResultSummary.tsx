import i18n from '@i18n/config';
import { useSimHost } from '@sim/context/SimHostContext';
import { useStoreSubscribe } from '@sim/hooks/useStoreSubscribe';
import { Tooltip, tooltipAnchorProps } from '@ui-kit/Tooltip';
import clsx from 'clsx';
import { useId } from 'react';

import { referenceDiffs } from '../../model/reference_diffs';
import type { SimResultsManager } from '../../model/results_manager';
import { toplineResultMetrics } from '../../model/topline_metrics';
import { ResultMetricList } from '../ResultMetricList';

export interface SimResultSummaryProps {
	results: SimResultsManager;
}

/** The finished run: the sidebar's stacked metric list and the reference bar over it. Renders nothing until a run completes, so the panel's result zone is empty at load. */
export const SimResultSummary = ({ results }: SimResultSummaryProps) => {
	const { cssScheme } = useSimHost().config;
	const tooltipId = useId();
	const { current, reference } = useStoreSubscribe(results.subscribe, results.getData);

	if (!current) return null;

	return (
		<div className="results-sim">
			<ResultMetricList
				metrics={toplineResultMetrics(current.simResult)}
				layout="list"
				referenceDiffs={reference ? referenceDiffs(current.simResult, reference.simResult) : undefined}
			/>
			<div className={clsx('results-sim-reference', reference && 'has-reference')}>
				<button
					type="button"
					className="results-sim-set-reference"
					onClick={() => results.setReference()}
					{...tooltipAnchorProps(tooltipId, i18n.t('sidebar.results.reference.use_as_reference'))}>
					<i className={`fa fa-map-pin fa-lg text-${cssScheme} me-2`} />
					{i18n.t('sidebar.results.reference.save_as_reference')}
				</button>
				<div className="results-sim-reference-bar">
					<button
						type="button"
						className="results-sim-reference-swap me-3"
						onClick={() => results.swapReference()}
						{...tooltipAnchorProps(tooltipId, i18n.t('sidebar.results.reference.swap_reference_with_current'))}>
						<i className="fas fa-arrows-rotate me-1" />
						{i18n.t('sidebar.results.reference.swap')}
					</button>
					<button
						type="button"
						className="results-sim-reference-delete"
						onClick={() => results.clearReference()}
						{...tooltipAnchorProps(tooltipId, i18n.t('sidebar.results.reference.remove_reference'))}>
						<i className="fa fa-times fa-lg me-1" />
						{i18n.t('sidebar.results.reference.cancel')}
					</button>
				</div>
			</div>
			<Tooltip id={tooltipId} />
		</div>
	);
};
