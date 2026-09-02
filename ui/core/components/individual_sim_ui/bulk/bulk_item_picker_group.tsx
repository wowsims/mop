import { BulkSimItemSlot } from '@domain/bulk/utils';
import { EquippedItem } from '@domain/proto_utils/equipped_item';
import { ContentBlock } from '@ui-kit/content_block';
import Toast from '@ui-kit/toast';

import i18n from '../../../../i18n/config';
import { getBulkSlotI18nKey } from '../../../../i18n/entity_mapping';
import { translateBulkSlotName } from '../../../../i18n/localization';
import { IndividualSimUI } from '../../../individual_sim_ui';
import { BulkTab } from '../bulk_tab';
import BulkItemPicker from './bulk_item_picker';

export default class BulkItemPickerGroup extends ContentBlock {
	readonly simUI: IndividualSimUI<any>;
	readonly bulkUI: BulkTab;
	readonly bulkSlot: BulkSimItemSlot;

	readonly pickers: Map<number, BulkItemPicker> = new Map();

	constructor(parent: HTMLElement, simUI: IndividualSimUI<any>, bulkUI: BulkTab, bulkSlot: BulkSimItemSlot) {
		const slotName = translateBulkSlotName(bulkSlot);
		super(parent, 'bulk-item-picker-group-root', { header: { title: slotName } });
		const slotKey = getBulkSlotI18nKey(bulkSlot);
		this.rootElem.classList.add(`gear-group-${slotKey.replace(/_/g, '-')}`);
		this.simUI = simUI;
		this.bulkUI = bulkUI;
		this.bulkSlot = bulkSlot;

		this.addEmptyElement();
	}

	has(idx: number) {
		return !!this.pickers.get(idx);
	}

	// True when the slot already holds as many copies of this exact item as can be worn.
	// Finger/trinket/weapon map to two physical slots, so two copies of a non-unique item fit.
	// A shared limit category is deliberately allowed: ilvl tiers of one trinket are distinct
	// ids (Evil Eye of Galakras ships six, all category 326) and comparing them is the point.
	// Keeping two out of the same combination is initGroupedSlotPairs' job.
	private isDuplicateOfExisting(item: EquippedItem): boolean {
		const isDualSlot =
			this.bulkSlot == BulkSimItemSlot.ItemSlotHandWeapon ||
			this.bulkSlot == BulkSimItemSlot.ItemSlotFinger ||
			this.bulkSlot == BulkSimItemSlot.ItemSlotTrinket;
		const maxCopies = isDualSlot && !item._item.unique ? 2 : 1;
		return Array.from(this.pickers.values()).filter(picker => picker.item.id === item.id).length >= maxCopies;
	}

	// Returns false if the item was rejected, so callers can undo the entry they pushed onto
	// the batch list; a stale one sims and counts toward combinations with no picker to remove it.
	add(idx: number, item: EquippedItem, silent = false): boolean {
		if (!this.pickers.size) this.bodyElement.replaceChildren();

		// Equipped pickers (idx < 0) report what is worn rather than offering a choice, so they
		// always render - the guard must never hide one.
		if (idx >= 0 && this.isDuplicateOfExisting(item)) {
			if (!silent)
				new Toast({
					delay: 1000,
					variant: 'error',
					body: <>{i18n.t('bulk_tab.search.item_unique', { itemName: item._item.name })}</>,
				});
			return false;
		}

		if (this.pickers.has(idx)) {
			const picker = this.pickers.get(idx);
			picker!.dispose();
			this.pickers.delete(idx);
		}

		this.pickers.set(idx, new BulkItemPicker(this.bodyElement, this.simUI, this.bulkUI, item, this.bulkSlot, idx));

		if (!silent)
			new Toast({
				delay: 1000,
				variant: 'success',
				body: <>{i18n.t('bulk_tab.search.item_added', { itemName: item._item.name })}</>,
			});

		return true;
	}

	update(idx: number, newItem: EquippedItem) {
		const picker = this.pickers.get(idx);
		if (!picker) {
			new Toast({
				variant: 'error',
				body: i18n.t('bulk_tab.picker.failed_update'),
			});
			return;
		}

		picker.setItem(newItem);
	}

	remove(idx: number, silent = false) {
		const picker = this.pickers.get(idx);
		if (!picker) {
			if (!silent)
				new Toast({
					variant: 'error',
					body: i18n.t('bulk_tab.picker.failed_remove'),
				});
			return;
		}

		picker.dispose();
		this.pickers.delete(idx);

		if (!this.pickers.size) this.addEmptyElement();

		if (!silent)
			new Toast({
				delay: 1000,
				variant: 'success',
				body: <>{i18n.t('bulk_tab.search.item_removed', { itemName: picker.item._item.name })}</>,
			});
	}

	private addEmptyElement() {
		this.bodyElement.appendChild(<span>{i18n.t('bulk_tab.picker.no_items')}</span>);
	}
}
