import type { Player } from '@domain/player';
import { subscribePlayerField } from '@domain/state/subscriptions';
import IconItemSwapPicker from '@features/gear/view/icon_item_swap_picker';
import { useSimHost } from '@features/SimHostContext';
import type { ItemSlot, Spec } from '@generated/proto/common';
import i18n from '@i18n/config';
import { BooleanPicker } from '@ui-kit/BooleanPicker';
import { Button } from '@ui-kit/Button';
import { useLegacyMount } from '@ui-kit/hooks/useLegacyMount';
import { useStoreSubscribe } from '@ui-kit/hooks/useStoreSubscribe';
import { Icon } from '@ui-kit/Icon';
import type { BooleanPickerConfig } from '@ui-kit/pickers/boolean_picker';
import { Tooltip } from '@ui-kit/Tooltip';
import clsx from 'clsx';
import { useId, useMemo } from 'react';

import { swapWithGear } from '../../model/swap_with_gear';

export interface ItemSwapPickerProps {
	itemSlots: ReadonlyArray<ItemSlot>;
	/** Declared by the vanilla config and never passed by anything. Kept rather than dropped. */
	note?: string;
}

/**
 * The item-swap block in the settings tab: a toggle, a swap button, and one icon picker per slot.
 *
 * The container and the note carry `hide` rather than being conditionally rendered. That is not a
 * missed simplification — `panes-parity.mjs` compares this pane element for element against the
 * vanilla build, where the toggle adds and removes a class on elements that always exist. Removing
 * them from the tree instead would be a real diff on every spec that ships item swap disabled,
 * which is all of them by default.
 */
export const ItemSwapPicker = <SpecType extends Spec>({ itemSlots, note }: ItemSwapPickerProps) => {
	const host = useSimHost();
	const player = host.player as Player<SpecType>;
	const swapId = useId();
	const labelId = useId();
	const swapTooltip = i18n.t('settings_tab.other.item_swap.tooltip');

	const subscribe = useMemo(() => subscribePlayerField(player, 'itemSwap'), [player]);
	const enabled = useStoreSubscribe(subscribe, () => player.itemSwapSettings.getEnableItemSwap());

	const enableConfig = useMemo(
		(): BooleanPickerConfig<Player<SpecType>> => ({
			id: 'enable-item-swap',
			reverse: true,
			label: i18n.t('settings_tab.other.enable_item_swap.label'),
			labelTooltip: i18n.t('settings_tab.other.enable_item_swap.tooltip'),
			extraCssClasses: ['input-inline'],
			storeSubscribe: (subject: Player<SpecType>) => subscribePlayerField(subject, 'itemSwap'),
			getValue: (subject: Player<SpecType>) => subject.itemSwapSettings.getEnableItemSwap(),
			setValue: (subject: Player<SpecType>, newValue: boolean) => subject.itemSwapSettings.setEnableItemSwap(newValue),
		}),
		[],
	);

	// One vanilla picker per slot, built straight into the group so the icons are its own children,
	// as they were when a fragment was appended into it.
	const mountIcons = useLegacyMount(parent => itemSlots.map(itemSlot => new IconItemSwapPicker(parent, host, player, itemSlot)), [host, player, itemSlots]);

	return (
		<div className="item-swap-picker-root">
			<BooleanPicker modObject={player} config={enableConfig} />
			<div className={clsx('input-root input-inline input-item-swap-container', !enabled && 'hide')}>
				{/* A `<label>` that labels nothing is not a label: this names the icon group below, which
				    is not a form control. The group says so itself instead. Recorded as an intended
				    divergence in `panes-parity.mjs`. */}
				<span className="form-label" id={labelId}>
					{i18n.t('settings_tab.other.item_swap.label')}
				</span>
				<Button
					variant="unstyled"
					className="gear-swap-icon"
					aria-label={swapTooltip}
					data-tooltip-id={swapId}
					onClick={() => swapWithGear(player, itemSlots)}>
					<Icon name="arrows-rotate" className="me-1" />
				</Button>
				<Tooltip id={swapId} content={swapTooltip} />
				<div className="picker-group icon-group" role="group" aria-labelledby={labelId} ref={mountIcons} />
			</div>
			{note && <p className={clsx('form-text', !enabled && 'hide')}>{note}</p>}
		</div>
	);
};
