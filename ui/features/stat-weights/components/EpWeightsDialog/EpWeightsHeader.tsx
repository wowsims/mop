import i18n from '@i18n/config';
import { Button } from '@ui-kit/Button';
import { Icon } from '@ui-kit/Icon';
import { tooltipAnchorProps } from '@ui-kit/Tooltip';
import clsx from 'clsx';

import type { EpColumn } from './types';
import { EP_TOOLTIP_ID } from './utils';

export interface EpWeightsHeaderProps {
	columns: EpColumn[];
	isTank: boolean;
	showThreatMetrics: boolean;
}

export const EpWeightsHeader = ({ columns, isTank, showThreatMetrics }: EpWeightsHeaderProps) => (
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
					data-column-type={isAction ? undefined : column.type}
					className={clsx(
						'ui-ep-weights-table-header-cell',
						showThreatMetrics && 'lg:max-xl:pr-0',
						isAction
							? 'text-center'
							: [
									'text-right',
									column.type === 'weight' ? 'in-data-[stats-type=ep]:hidden' : 'in-data-[stats-type=weight]:hidden',
									showThreatMetrics && 'max-lg:text-center',
								],
					)}>
					<span {...tooltipAnchorProps(EP_TOOLTIP_ID, column.labelTooltip)}>{column.label}</span>
					<Button
						variant="unstyled"
						data-testid="col-action"
						className="ml-1"
						onClick={column.onCopy}
						{...tooltipAnchorProps(EP_TOOLTIP_ID, column.actionTooltip)}>
						<Icon name={isAction ? 'arrows-rotate' : 'copy'} />
					</Button>
				</th>
			);
		})}
	</tr>
);
