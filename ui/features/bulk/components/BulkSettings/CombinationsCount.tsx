import { useSim } from '@sim/context/SimHostContext';
import { formatToNumber } from '@sim/utils/format';
import i18n from '@i18n/config';
import { Icon } from '@ui-kit/Icon';
import { Spinner } from '@ui-kit/Spinner';
import { Tooltip, tooltipAnchorProps } from '@ui-kit/Tooltip';
import clsx from 'clsx';
import { useId } from 'react';

import { useBulkState } from '../../hooks/useBulkState';
import { bulkIterationsLimit } from '../../model/limits';

export const CombinationsCount = () => {
	const sim = useSim();
	const tooltipId = useId();
	const pending = useBulkState(slice => slice.combinationsPending);
	const combinations = useBulkState(slice => slice.combinations);
	const iterations = useBulkState(slice => slice.iterations);

	if (pending) {
		return (
			<div className="bulk-combinations-count h4 mb-0 flex items-center gap-2 xl:max-xxl:flex-wrap">
				<Spinner size="sm" />
			</div>
		);
	}

	const iterationsLimit = bulkIterationsLimit(sim.isNative);
	const showWarning = iterations > iterationsLimit;
	return (
		<div className="bulk-combinations-count h4 mb-0 flex items-center gap-2 xl:max-xxl:flex-wrap">
			<span className={clsx(showWarning && 'text-danger')}>
				{combinations === 1
					? i18n.t('bulk_tab.settings.combination_singular')
					: i18n.t('bulk_tab.settings.combinations_count', { amount: formatToNumber(combinations) })}
				<br />
				<small className="text-base">
					{formatToNumber(iterations)} {i18n.t('bulk_tab.settings.iterations')}
				</small>
			</span>
			{showWarning && (
				<>
					<button
						type="button"
						className="warning link-warning text-link-warning xl:max-xxl:order-[-1]"
						{...tooltipAnchorProps(tooltipId)}
					>
						<Icon name="exclamation-triangle" size="2x" />
					</button>
					<Tooltip id={tooltipId} place="left" content={i18n.t('bulk_tab.warning.iterations_limit', { limit: formatToNumber(iterationsLimit) })} />
				</>
			)}
		</div>
	);
};
