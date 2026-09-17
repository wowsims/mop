import i18n from '@i18n/config';
import type { Player } from '@sim/player/player';
import { Button } from '@ui-kit/Button';
import { Icon } from '@ui-kit/Icon';
import { NumberPicker } from '@ui-kit/NumberPicker';
import { tooltipAnchorProps } from '@ui-kit/Tooltip';
import clsx from 'clsx';

import type { EpColumn } from './types';
import { EP_TOOLTIP_ID } from './utils';

export interface EpRatiosRowProps {
	columns: EpColumn[];
	player: Player<any>;
	onComputeEp: () => void;
	showThreatMetrics: boolean;
}

export const EpRatiosRow = ({ columns, player, onComputeEp, showThreatMetrics }: EpRatiosRowProps) => {
	const cellClassName = clsx('ui-ep-weights-table-cell', showThreatMetrics && 'max-lg:pl-0');

	return (
		<tr data-testid="ep-ratios" className="bg-(--table-row-even-bg)">
			<td className={cellClassName}>{i18n.t('sidebar.buttons.stat_weights.modal.column_headers.ep_ratio')}</td>
			<td className={cellClassName} />
			{columns
				.filter(column => column.type !== 'action')
				.map(column => (
					<td
						key={column.id}
						data-column-type={column.type}
						className={clsx(
							cellClassName,
							'text-right',
							column.type === 'weight' ? 'in-data-[stats-type=ep]:hidden' : 'in-data-[stats-type=weight]:hidden',
						)}>
						<NumberPicker
							modObject={player}
							config={{
								id: `ep-ratio-${column.type}-${column.ratioIndex}`,
								float: true,
								storeField: 'epRatios',
								extraClassNames: ['items-end', 'mb-0'],
								getValue: subject => subject.getEpRatios()[column.ratioIndex!],
								setValue: (subject, newValue) => {
									const epRatios = subject.getEpRatios();
									epRatios[column.ratioIndex!] = newValue;
									subject.setEpRatios(epRatios);
								},
							}}
							inputClassName={clsx('ui-ep-weights-input-align-right max-w-25', showThreatMetrics && 'ui-ep-weights-compact-input')}
						/>
					</td>
				))}
			<td className={clsx(cellClassName, 'text-center align-middle')}>
				<Button
					data-testid="compute-ep"
					className="whitespace-nowrap"
					onClick={onComputeEp}
					{...tooltipAnchorProps(EP_TOOLTIP_ID, i18n.t('sidebar.buttons.stat_weights.modal.tooltips.compute_weighted_ep'))}>
					<Icon name="calculator" className="inline align-middle" />
					<span data-testid="not-tiny" className={clsx(showThreatMetrics && 'max-lg:hidden')}>
						{i18n.t('sidebar.buttons.stat_weights.modal.column_headers.update_ep_button')}
					</span>
				</Button>
			</td>
		</tr>
	);
};
