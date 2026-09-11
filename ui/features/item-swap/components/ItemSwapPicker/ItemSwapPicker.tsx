import './ItemSwapPicker.scss';

import type { ItemSlot, Spec } from '@generated/proto/common';
import i18n from '@i18n/config';
import { useSimHost } from '@sim/context/SimHostContext';
import { useStoreSubscribe } from '@sim/hooks/useStoreSubscribe';
import type { Player } from '@sim/player/player';
import { subscribePlayerField } from '@sim/state/subscriptions';
import { BooleanPicker } from '@ui-kit/BooleanPicker';
import type { BooleanPickerConfig } from '@ui-kit/BooleanPicker/types';
import { Button } from '@ui-kit/Button';
import { Icon } from '@ui-kit/Icon';
import { Tooltip, tooltipAnchorProps } from '@ui-kit/Tooltip';
import clsx from 'clsx';
import { useId, useMemo } from 'react';

import { swapWithGear } from '../../model/swap_with_gear';
import { ItemSwapIcon } from '../ItemSwapIcon';

export interface ItemSwapPickerProps {
	itemSlots: ReadonlyArray<ItemSlot>;
	note?: string;
}

export const ItemSwapPicker = <SpecType extends Spec>({ itemSlots, note }: ItemSwapPickerProps) => {
	const host = useSimHost();
	const player = host.player as Player<SpecType>;
	const swapId = useId();
	const labelId = useId();
	const swapTooltip = i18n.t('settings_tab.other.item_swap.tooltip');

	const subscribe = subscribePlayerField(player, 'itemSwap');
	const enabled = useStoreSubscribe(subscribe, () => player.itemSwapSettings.getEnableItemSwap());

	const enableConfig = useMemo(
		(): BooleanPickerConfig<Player<SpecType>> => ({
			id: 'enable-item-swap',
			reverse: true,
			label: i18n.t('settings_tab.other.enable_item_swap.label'),
			labelTooltip: i18n.t('settings_tab.other.enable_item_swap.tooltip'),
			extraClassNames: ['input-inline'],
			storeField: 'itemSwap',
			getValue: (subject: Player<SpecType>) => subject.itemSwapSettings.getEnableItemSwap(),
			setValue: (subject: Player<SpecType>, newValue: boolean) => subject.itemSwapSettings.setEnableItemSwap(newValue),
		}),
		[],
	);

	return (
		<div className="item-swap-picker-root">
			<BooleanPicker modObject={player} config={enableConfig} />
			<div className={clsx('input-root input-inline input-item-swap-container', !enabled && 'hide')}>
				<span className="form-label" id={labelId}>
					{i18n.t('settings_tab.other.item_swap.label')}
				</span>
				<Button
					variant="unstyled"
					className="gear-swap-icon"
					aria-label={swapTooltip}
					{...tooltipAnchorProps(swapId)}
					onClick={() => swapWithGear(player, itemSlots)}>
					<Icon name="arrows-rotate" className="me-1" />
				</Button>
				<Tooltip id={swapId} content={swapTooltip} />
				<div className="picker-group icon-group" role="group" aria-labelledby={labelId}>
					{itemSlots.map(itemSlot => (
						<ItemSwapIcon key={itemSlot} slot={itemSlot} />
					))}
				</div>
			</div>
			{note && <p className={clsx('form-text', !enabled && 'hide')}>{note}</p>}
		</div>
	);
};
