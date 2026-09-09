import { formatToNumber } from '@sim/utils/format';
import i18n from '@i18n/config';
import { Icon } from '@ui-kit/Icon';
import { Tooltip, tooltipAnchorProps } from '@ui-kit/Tooltip';
import clsx from 'clsx';
import { useId } from 'react';

import { useBulkRevision } from '../../hooks/useBulkRevision';
import { useBulkTab } from '../../hooks/useBulkTab';

export const CombinationsCount = () => {
	const bt = useBulkTab();
	const tooltipId = useId();
	useBulkRevision();

	if (bt.combinationsPending) {
		return (
			<div className="bulk-combinations-count h4">
				<div className="loader" />
			</div>
		);
	}

	const showWarning = bt.showIterationsWarning();
	return (
		<div className="bulk-combinations-count h4">
			<span className={clsx(showWarning && 'text-danger')}>
				{bt.combinations === 1
					? i18n.t('bulk_tab.settings.combination_singular')
					: i18n.t('bulk_tab.settings.combinations_count', { amount: formatToNumber(bt.combinations) })}
				<br />
				<small>
					{formatToNumber(bt.iterations)} {i18n.t('bulk_tab.settings.iterations')}
				</small>
			</span>
			{showWarning && (
				<>
					<button type="button" className="warning link-warning" {...tooltipAnchorProps(tooltipId)}>
						<Icon name="exclamation-triangle" size="2x" />
					</button>
					<Tooltip
						id={tooltipId}
						place="left"
						content={i18n.t('bulk_tab.warning.iterations_limit', { limit: formatToNumber(bt.getIterationsLimit()) })}
					/>
				</>
			)}
		</div>
	);
};
