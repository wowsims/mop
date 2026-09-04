/** @jsxImportSource @jsx-vanilla */
import { Player } from '@domain/player';
import { batch } from '@domain/state/batch';
import { subscribePlayerField } from '@domain/state/subscriptions';
import type { SimHost } from '@features/sim_host';
import { ItemSlot, Spec } from '@generated/proto/common';
import i18n from '@i18n/config';
import { Component } from '@ui-kit/component';
import { Input } from '@ui-kit/input';
import { BooleanPicker } from '@ui-kit/pickers/boolean_picker';
import tippy from 'tippy.js';
import { ref } from 'tsx-vanilla';

import IconItemSwapPicker from '../../gear/view/icon_item_swap_picker';
export interface ItemSwapPickerConfig {
	itemSlots: Array<ItemSlot>;
	note?: string;
}

export class ItemSwapPicker<SpecType extends Spec> extends Component {
	private readonly itemSlots: Array<ItemSlot>;

	constructor(parentElem: HTMLElement, simUI: SimHost, player: Player<SpecType>, config: ItemSwapPickerConfig) {
		super(parentElem, 'item-swap-picker-root');
		this.itemSlots = config.itemSlots;

		new BooleanPicker(this.rootElem, player, {
			id: 'enable-item-swap',
			reverse: true,
			label: i18n.t('settings_tab.other.enable_item_swap.label'),
			labelTooltip: i18n.t('settings_tab.other.enable_item_swap.tooltip'),
			extraCssClasses: ['input-inline'],
			getValue: (player: Player<SpecType>) => player.itemSwapSettings.getEnableItemSwap(),
			setValue(player: Player<SpecType>, newValue: boolean) {
				player.itemSwapSettings.setEnableItemSwap(newValue);
			},
			storeSubscribe: (player: Player<SpecType>) => subscribePlayerField(player, 'itemSwap'),
		});

		const swapPickerContainerRef = ref<HTMLDivElement>();
		const swapButtonRef = ref<HTMLButtonElement>();
		const noteRef = ref<HTMLParagraphElement>();
		const itemSwapContainer = Input.newGroupContainer('icon-group');

		this.rootElem.appendChild(
			<>
				<div ref={swapPickerContainerRef} className="input-root input-inline input-item-swap-container">
					<label className="form-label">{i18n.t('settings_tab.other.item_swap.label')}</label>
					<button ref={swapButtonRef} className="gear-swap-icon">
						<i className="fas fa-arrows-rotate me-1"></i>
					</button>
					{itemSwapContainer}
				</div>
				{config.note && (
					<p ref={noteRef} className="form-text">
						{config.note}
					</p>
				)}
			</>,
		);

		const toggleEnabled = () => {
			if (!player.itemSwapSettings.getEnableItemSwap()) {
				swapPickerContainerRef.value?.classList.add('hide');
				noteRef.value?.classList.add('hide');
			} else {
				swapPickerContainerRef.value?.classList.remove('hide');
				noteRef.value?.classList.remove('hide');
			}
		};
		subscribePlayerField(player, 'itemSwap')(toggleEnabled);
		toggleEnabled();

		if (swapButtonRef.value) {
			swapButtonRef.value.addEventListener('click', _event => this.swapWithGear(player));
			tippy(swapButtonRef.value, {
				content: i18n.t('settings_tab.other.item_swap.tooltip'),
			});
		}

		const tmpContainer = (<></>) as HTMLElement;
		this.itemSlots.forEach(itemSlot => {
			new IconItemSwapPicker(tmpContainer, simUI, player, itemSlot);
		});

		itemSwapContainer.appendChild(tmpContainer);
	}

	swapWithGear(player: Player<SpecType>) {
		let newGear = player.getGear();
		let newIsg = player.itemSwapSettings.getGear();

		this.itemSlots.forEach(slot => {
			const gearItem = player.getGear().getEquippedItem(slot);
			const swapItem = player.itemSwapSettings.getGear().getEquippedItem(slot);

			newGear = newGear.withEquippedItem(slot, swapItem, player.canDualWield2H());
			newIsg = newIsg.withEquippedItem(slot, gearItem, player.canDualWield2H());
		});

		batch(() => {
			player.setGear(newGear);
			player.itemSwapSettings.setGear(newIsg);
		});
	}
}