import i18n from '@i18n/config';
import { useSim, useSimHost } from '@sim/context/SimHostContext';
import { useDisplayMetrics } from '@sim/hooks/useDisplayMetrics';
import { useStoreSubscribe } from '@sim/hooks/useStoreSubscribe';
import { textClassName } from '@sim/proto/utils';
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
	const displayMetrics = useDisplayMetrics(useSim());
	const tooltipId = useId();
	const { current, reference } = useStoreSubscribe(results.subscribe, results.getData);

	if (!current) return null;

	return (
		<div data-testid="results-sim" className="text-center">
			<ResultMetricList
				metrics={toplineResultMetrics(current.simResult, undefined, { displayMetrics })}
				layout="list"
				referenceDiffs={reference ? referenceDiffs(current.simResult, reference.simResult) : undefined}
			/>
			<div className="mt-2 font-normal" data-testid="results-sim-reference" data-has-reference={reference ? '' : undefined}>
				<button
					type="button"
					className={clsx(reference && 'hidden')}
					data-testid="results-sim-set-reference"
					onClick={() => results.setReference()}
					{...tooltipAnchorProps(tooltipId, i18n.t('sidebar.results.reference.use_as_reference'))}>
					<i className={`fa fa-map-pin fa-lg ${textClassName(cssScheme)} mr-2`} />
					{i18n.t('sidebar.results.reference.save_as_reference')}
				</button>
				<div className={clsx(!reference && 'hidden')}>
					<button
						type="button"
						className="mr-4"
						data-testid="results-sim-reference-swap"
						onClick={() => results.swapReference()}
						{...tooltipAnchorProps(tooltipId, i18n.t('sidebar.results.reference.swap_reference_with_current'))}>
						<i className="fas fa-arrows-rotate mr-1" />
						{i18n.t('sidebar.results.reference.swap')}
					</button>
					<button
						type="button"
						data-testid="results-sim-reference-delete"
						onClick={() => results.clearReference()}
						{...tooltipAnchorProps(tooltipId, i18n.t('sidebar.results.reference.remove_reference'))}>
						<i className="fa fa-times fa-lg mr-1" />
						{i18n.t('sidebar.results.reference.cancel')}
					</button>
				</div>
			</div>
			<Tooltip id={tooltipId} />
		</div>
	);
};
