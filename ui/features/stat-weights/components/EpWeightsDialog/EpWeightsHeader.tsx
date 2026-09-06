import i18n from '@i18n/config';
import { Button } from '@ui-kit/Button';
import { Icon } from '@ui-kit/Icon';
import { tooltipAnchorProps } from '@ui-kit/Tooltip';
import clsx from 'clsx';

import type { EpColumn } from './types';
import { EP_TOOLTIP_ID } from './utils';

export interface EpWeightsHeaderProps {
	columns: EpColumn[];
}

export const EpWeightsHeader = ({ columns }: EpWeightsHeaderProps) => (
	<tr>
		<th>{i18n.t('sidebar.buttons.stat_weights.modal.column_headers.stat')}</th>
		<th>{i18n.t('sidebar.buttons.stat_weights.modal.column_headers.update')}</th>
		{columns.map(column => {
			const isAction = column.type === 'action';
			return (
				<th key={column.id} className={clsx(column.metric && `${column.metric}-metrics`, isAction ? 'text-center' : `type-${column.type}`)}>
					<span {...tooltipAnchorProps(EP_TOOLTIP_ID, column.labelTooltip)}>{column.label}</span>
					<Button variant="unstyled" className="col-action" onClick={column.onCopy} {...tooltipAnchorProps(EP_TOOLTIP_ID, column.actionTooltip)}>
						<Icon name={isAction ? 'arrows-rotate' : 'copy'} />
					</Button>
				</th>
			);
		})}
	</tr>
);
