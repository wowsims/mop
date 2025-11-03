import tippy from 'tippy.js';
import { ref } from 'tsx-vanilla';

import i18n from '../../../../i18n/config';
import { IndividualSimUI } from '../../../individual_sim_ui';
import { ItemSlot } from '../../../proto/common';
import { EquippedItem } from '../../../proto_utils/equipped_item';
import { getEligibleItemSlots } from '../../../proto_utils/utils';
import { TypedEvent } from '../../../typed_event';
import { Component } from '../../component';
import { ItemRenderer } from '../../gear_picker/gear_picker';
import { GearData } from '../../gear_picker/item_list';
import { SelectorModalTabs } from '../../gear_picker/selector_modal';
import { BulkTab } from '../bulk_tab';
import { BulkSimItemSlot } from './utils';

export default class BulkItemPicker extends Component {
	private readonly itemElem: ItemRenderer;
	readonly simUI: IndividualSimUI<any>;
	readonly bulkUI: BulkTab;
	readonly bulkSlot: BulkSimItemSlot;
	// If less than 0, the item is currently equipped and not stored in the batch sim's item array
	readonly index: number;
	item: EquippedItem;

	// Can be used to remove any events in addEventListener
	// https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener#add_an_abortable_listener
	public abortController: AbortController;
	public signal: AbortSignal;

	constructor(parent: HTMLElement, simUI: IndividualSimUI<any>, bulkUI: BulkTab, item: EquippedItem, bulkSlot: BulkSimItemSlot, index: number) {
		super(parent, 'bulk-item-picker');

		this.simUI = simUI;
		this.bulkUI = bulkUI;
		this.bulkSlot = bulkSlot;
		this.index = index;
		this.item = item;
		this.itemElem = new ItemRenderer(parent, this.rootElem, simUI.player);
		this.abortController = new AbortController();
		this.signal = this.abortController.signal;

		if (!this.isEditable()) {
			this.rootElem.classList.add('bulk-item-picker-equipped');
			parent.insertAdjacentElement('afterbegin', this.rootElem);
		}

		this.addActions();

		this.simUI.sim.waitForInit().then(() => this.setItem(item));

		this.addOnDisposeCallback(() => this.rootElem.remove());

		const updateBorder = () => {
			if (this.bulkUI.frozenItems.get(this.bulkSlot)?.equals(this.item)) {
				this.rootElem.classList.remove('bulk-item-picker-equipped');
				this.rootElem.classList.add('bulk-item-picker-frozen');
			} else {
				this.rootElem.classList.remove('bulk-item-picker-frozen');
				this.rootElem.classList.add('bulk-item-picker-equipped');
			}
		};

		updateBorder();
		TypedEvent.onAny([this.bulkUI.settingsChangedEmitter, this.bulkUI.itemsChangedEmitter]).on(() => updateBorder());
	}

	setItem(newItem: EquippedItem) {
		this.itemElem.clear(ItemSlot.ItemSlotHead);
		this.itemElem.update(newItem);
		this.item = newItem;
		this.setupHandlers();
	}

	private isEditable(): boolean {
		return this.index >= 0;
	}

	private setupHandlers() {
		const slot = getEligibleItemSlots(this.item.item)[0];
		const hasEligibleEnchants = !!this.simUI.sim.db.getEnchants(slot).length;
		const hasEligibleReforges = this.item?.item ? this.simUI.player.getAvailableReforgings(this.item) : [];

		const openItemSelector = (event: Event) => {
			event.preventDefault();
			if (!this.isEditable()) return;

			this.bulkUI.selectorModal.openTab(slot, SelectorModalTabs.Items, this.createGearData());
		};

		const openEnchantSelector = (event: Event) => {
			event.preventDefault();
			if (!this.isEditable()) return;

			if (hasEligibleEnchants) {
				this.bulkUI.selectorModal.openTab(slot, SelectorModalTabs.Enchants, this.createGearData());
			}
		};

		const openReforgeSelector = (event: Event) => {
			event.preventDefault();
			if (!this.isEditable()) return;

			if (hasEligibleReforges.length) {
				this.bulkUI.selectorModal.openTab(slot, SelectorModalTabs.Reforging, this.createGearData());
			}
		};

		const openGemSelector = (event: Event, gemIdx: number) => {
			event.preventDefault();
			if (!this.isEditable()) return;

			let tab = SelectorModalTabs.Gem1;
			if (gemIdx === 1) tab = SelectorModalTabs.Gem2;
			if (gemIdx === 2) tab = SelectorModalTabs.Gem3;

			this.bulkUI.selectorModal.openTab(slot, tab, this.createGearData());
		};

		this.itemElem.iconElem.addEventListener('click', openItemSelector, { signal: this.signal });
		this.itemElem.nameElem.addEventListener('click', openItemSelector, { signal: this.signal });
		this.itemElem.enchantElem.addEventListener('click', openEnchantSelector, { signal: this.signal });
		this.itemElem.reforgeElem.addEventListener('click', openReforgeSelector, { signal: this.signal });
		this.itemElem.socketsElem.forEach((elem, idx) => elem.addEventListener('click', e => openGemSelector(e, idx), { signal: this.signal }));
	}

	private createGearData(): GearData {
		const changeEvent = new TypedEvent<void>();
		return {
			equipItem: (_, newItem: EquippedItem | null) => {
				if (newItem) {
					this.bulkUI.updateItem(this.index, newItem.asSpec());
					changeEvent.emit(TypedEvent.nextEventID());
				}
			},
			getEquippedItem: () => this.item,
			changeEvent: changeEvent,
		};
	}

	private addActions() {
		const removeBtnRef = ref<HTMLButtonElement>();

		this.itemElem.rootElem.appendChild(
			<div className="item-picker-actions-container">
				{this.isEditable() && (
					<button className="btn btn-link link-danger item-picker-actions-btn" ref={removeBtnRef}>
						<i className="fas fa-times" />
					</button>
				)}
			</div>,
		);

		if (removeBtnRef.value) {
			const removeBtn = removeBtnRef.value;
			tippy(removeBtn, { content: i18n.t('bulk_tab.picker.remove_tooltip') });
			const removeItem = () => this.bulkUI.removeItemByIndex(this.index);
			removeBtn.addEventListener('click', removeItem);
			this.addOnDisposeCallback(() => removeBtn.removeEventListener('click', removeItem));
		}
	}
}
