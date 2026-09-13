import i18n from '@i18n/config';
import { metricsClassName } from '@features/results/model/sim_results';
import { Button } from '@ui-kit/Button';
import { Icon } from '@ui-kit/Icon';
import { tooltipAnchorProps } from '@ui-kit/Tooltip';
import clsx from 'clsx';

import type { EpColumn } from './types';
import { EP_TOOLTIP_ID } from './utils';

export interface EpWeightsHeaderProps {
	columns: EpColumn[];
	showThreatMetrics: boolean;
	isTank: boolean;
}

export const EpWeightsHeader = ({ columns, showThreatMetrics, isTank }: EpWeightsHeaderProps) => (
	<tr>
		<th className={clsx('ui-ep-weights-table-header-cell', showThreatMetrics && 'lg:max-xl:pr-0')}>
			{i18n.t('sidebar.buttons.stat_weights.modal.column_headers.stat')}
		</th>
		{!isTank && (
			<th className={clsx('ui-ep-weights-table-header-cell', showThreatMetrics && 'lg:max-xl:pr-0')}>
				{i18n.t('sidebar.buttons.stat_weights.modal.column_headers.update')}
			</th>
		)}
		{columns.map(column => {
			const isAction = column.type === 'action';
			return (
				<th
					key={column.id}
					className={clsx(
						'ui-ep-weights-table-header-cell',
						showThreatMetrics && 'lg:max-xl:pr-0',
						column.metric && metricsClassName(column.metric),
						isAction
							? 'text-center'
							: [
									`type-${column.type}`,
									'text-right',
									column.type === 'weight' ? 'in-data-[stats-type=ep]:hidden' : 'in-data-[stats-type=weight]:hidden',
									showThreatMetrics && 'max-lg:text-center',
								],
					)}>
					<span {...tooltipAnchorProps(EP_TOOLTIP_ID, column.labelTooltip)}>{column.label}</span>
					<Button variant="unstyled" className="col-action ml-1" onClick={column.onCopy} {...tooltipAnchorProps(EP_TOOLTIP_ID, column.actionTooltip)}>
						<Icon name={isAction ? 'arrows-rotate' : 'copy'} />
					</Button>
				</th>
			);
		})}
	</tr>
);
