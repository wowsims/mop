import type { Player } from '@domain/player';
import { subscribePlayerField } from '@domain/state/subscriptions';
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
}

export const EpRatiosRow = ({ columns, player, onComputeEp }: EpRatiosRowProps) => (
	<tr className="ep-ratios">
		<td>{i18n.t('sidebar.buttons.stat_weights.modal.column_headers.ep_ratio')}</td>
		<td />
		{columns
			.filter(column => column.type !== 'action')
			.map(column => (
				<td key={column.id} className={clsx('type-ratio', `${column.metric}-metrics`, `type-${column.type}`)}>
					<NumberPicker
						modObject={player}
						config={{
							id: `ep-ratio-${column.type}-${column.ratioIndex}`,
							float: true,
							storeSubscribe: subject => subscribePlayerField(subject, 'epRatios'),
							getValue: subject => subject.getEpRatios()[column.ratioIndex!],
							setValue: (subject, newValue) => {
								const epRatios = subject.getEpRatios();
								epRatios[column.ratioIndex!] = newValue;
								subject.setEpRatios(epRatios);
							},
						}}
					/>
				</td>
			))}
		<td className="text-center align-middle">
			<Button
				className="compute-ep"
				onClick={onComputeEp}
				{...tooltipAnchorProps(EP_TOOLTIP_ID, i18n.t('sidebar.buttons.stat_weights.modal.tooltips.compute_weighted_ep'))}>
				<Icon name="calculator" />
				<span className="not-tiny">{i18n.t('sidebar.buttons.stat_weights.modal.column_headers.update_ep_button')}</span>
			</Button>
		</td>
	</tr>
);
