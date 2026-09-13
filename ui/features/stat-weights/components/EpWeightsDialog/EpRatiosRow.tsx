import type { Player } from '@sim/player/player';
import { metricsClassName } from '@features/results/model/sim_results';
import i18n from '@i18n/config';
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
	const cellClassName = showThreatMetrics ? 'ui-ep-weights-compact-table-cell' : 'ui-ep-weights-table-cell';

	return (
		<tr className="ep-ratios bg-(--table-row-even-bg)">
			<td className={cellClassName}>{i18n.t('sidebar.buttons.stat_weights.modal.column_headers.ep_ratio')}</td>
			<td className={cellClassName} />
			{columns
				.filter(column => column.type !== 'action')
				.map(column => (
					<td
						key={column.id}
						className={clsx(
							cellClassName,
							'text-right',
							column.type === 'weight' ? 'in-data-[stats-type=ep]:hidden' : 'in-data-[stats-type=weight]:hidden',
							column.metric && metricsClassName(column.metric),
							`type-${column.type}`,
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
							inputClassName={clsx('max-w-[100px] ui-ep-weights-input-align-right', showThreatMetrics && 'ui-ep-weights-compact-input')}
						/>
					</td>
				))}
			<td className={clsx(cellClassName, 'text-center align-middle')}>
				<Button
					className="compute-ep whitespace-nowrap"
					onClick={onComputeEp}
					{...tooltipAnchorProps(EP_TOOLTIP_ID, i18n.t('sidebar.buttons.stat_weights.modal.tooltips.compute_weighted_ep'))}>
					<Icon name="calculator" className="inline align-middle" />
					<span data-testid="not-tiny" className={clsx('not-tiny', showThreatMetrics && 'max-lg:hidden')}>
						{i18n.t('sidebar.buttons.stat_weights.modal.column_headers.update_ep_button')}
					</span>
				</Button>
			</td>
		</tr>
	);
};
