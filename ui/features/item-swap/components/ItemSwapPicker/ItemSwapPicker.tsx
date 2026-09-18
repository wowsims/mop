import type { ItemSlot, Spec } from '@generated/proto/common';
import i18n from '@i18n/config';
import { useSimHost } from '@sim/context/SimHostContext';
import { usePlayerStore } from '@sim/hooks/usePlayerStore';
import type { Player } from '@sim/player/player';
import { BooleanPicker } from '@ui-kit/BooleanPicker';
import type { BooleanPickerConfig } from '@ui-kit/BooleanPicker/types';
import { Button } from '@ui-kit/Button';
import { FieldLabel, HelpText } from '@ui-kit/FormControl';
import { Icon } from '@ui-kit/Icon';
import { PickerGroup } from '@ui-kit/PickerGroup';
import { LocaleHtml, Tooltip, tooltipAnchorProps } from '@ui-kit/Tooltip';
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

	const enabled = usePlayerStore('itemSwapEnabled');

	const enableConfig = useMemo(
		(): BooleanPickerConfig<Player<SpecType>> => ({
			id: 'enable-item-swap',
			reverse: true,
			label: i18n.t('settings_tab.other.enable_item_swap.label'),
			labelTooltip: <LocaleHtml html={i18n.t('settings_tab.other.enable_item_swap.tooltip')} />,
			layout: 'split',
			storeField: 'itemSwap',
			getValue: (subject: Player<SpecType>) => subject.itemSwapSettings.getEnableItemSwap(),
			setValue: (subject: Player<SpecType>, newValue: boolean) => subject.itemSwapSettings.setEnableItemSwap(newValue),
		}),
		[],
	);

	return (
		<div className="grid gap-3" data-testid="item-swap-picker-root">
			<BooleanPicker modObject={player} config={enableConfig} />
			{enabled && (
				<div className="ui-field flex-wrap gap-3" data-testid="input-item-swap-container" data-input-root="" data-layout="split">
					<FieldLabel as="span" id={labelId}>
						{i18n.t('settings_tab.other.item_swap.label')}
					</FieldLabel>
					<Button
						variant="unstyled"
						data-testid="gear-swap-icon"
						aria-label={swapTooltip}
						{...tooltipAnchorProps(swapId)}
						onClick={() => swapWithGear(player, itemSlots)}>
						<Icon name="arrows-rotate" className="me-1" />
					</Button>
					<Tooltip id={swapId} content={swapTooltip} />
					<PickerGroup
						variant="icons"
						className="items-center justify-end"
						style={{ gridTemplateColumns: `repeat(${itemSlots.length}, 4rem)` }}
						role="group"
						aria-labelledby={labelId}>
						{itemSlots.map(itemSlot => (
							<ItemSwapIcon key={itemSlot} slot={itemSlot} />
						))}
					</PickerGroup>
				</div>
			)}
			{note && enabled && <HelpText as="p">{note}</HelpText>}
		</div>
	);
};
