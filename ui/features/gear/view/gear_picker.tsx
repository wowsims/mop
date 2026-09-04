/** @jsxImportSource @jsx-vanilla */
import { Player } from '@domain/player';
import { setEquippedItemWowheadData } from '@domain/proto_utils/action_id/dom';
import { EquippedItem } from '@domain/proto_utils/equipped_item';
import { subscribeAll, subscribePlayerField, subscribeSimField, subscribeUiField } from '@domain/state/subscriptions';
import type { SimHost } from '@features/sim_host';
import { ItemSlot } from '@generated/proto/common';
import { UIEnchant as Enchant, UIGem as Gem } from '@generated/proto/ui';
import { Component } from '@ui-kit/component';
import { ref } from 'tsx-vanilla';

import { GearData } from './item_list';
import { ItemRenderer } from './item_renderer';
import { addQuickEnchantPopover } from './quick_enchant_popover';
import { addQuickGemPopover } from './quick_gem_popover';
import QuickSwapList from './quick_swap';
import SelectorModal, { SelectorModalTabs } from './selector_modal';
export const LEFT_ITEM_PICKERS = [
	ItemSlot.ItemSlotHead,
	ItemSlot.ItemSlotNeck,
	ItemSlot.ItemSlotShoulder,
	ItemSlot.ItemSlotBack,
	ItemSlot.ItemSlotChest,
	ItemSlot.ItemSlotWrist,
	ItemSlot.ItemSlotMainHand,
	ItemSlot.ItemSlotOffHand,
];

export const RIGHT_ITEM_PICKERS = [
	ItemSlot.ItemSlotHands,
	ItemSlot.ItemSlotWaist,
	ItemSlot.ItemSlotLegs,
	ItemSlot.ItemSlotFeet,
	ItemSlot.ItemSlotFinger1,
	ItemSlot.ItemSlotFinger2,
	ItemSlot.ItemSlotTrinket1,
	ItemSlot.ItemSlotTrinket2,
];

export default class GearPicker extends Component {
	// ItemSlot is used as the index
	readonly itemPickers: Array<ItemPicker>;
	readonly selectorModal: SelectorModal;

	constructor(parent: HTMLElement, simUI: SimHost, player: Player<any>) {
		super(parent, 'gear-picker-root');

		const leftSideRef = ref<HTMLDivElement>();
		const rightSideRef = ref<HTMLDivElement>();

		this.rootElem.appendChild(
			<>
				<div ref={leftSideRef} className="gear-picker-left tab-panel-col"></div>
				<div ref={rightSideRef} className="gear-picker-right tab-panel-col"></div>
			</>,
		);

		const leftItemPickers = LEFT_ITEM_PICKERS.map(slot => new ItemPicker(leftSideRef.value!, this, simUI, player, slot));

		const rightItemPickers = RIGHT_ITEM_PICKERS.map(slot => new ItemPicker(rightSideRef.value!, this, simUI, player, slot));

		this.itemPickers = leftItemPickers.concat(rightItemPickers).sort((a, b) => a.slot - b.slot);

		this.selectorModal = new SelectorModal(simUI.rootElem, simUI, player, this, { id: 'gear-picker-selector-modal' });
	}
}

export class ItemPicker extends Component {
	readonly slot: ItemSlot;

	private readonly simUI: SimHost;
	private readonly player: Player<any>;

	private readonly onUpdateCallbacks: (() => void)[] = [];

	private readonly itemElem: ItemRenderer;
	private readonly gearPicker: GearPicker;

	// All items and enchants that are eligible for this slot
	private _equippedItem: EquippedItem | null = null;

	private quickSwapEnchantPopover: QuickSwapList<Enchant> | null = null;
	private quickSwapGemPopover: QuickSwapList<Gem>[] = [];
	private simInitialized = false;

	constructor(parent: HTMLElement, gearPicker: GearPicker, simUI: SimHost, player: Player<any>, slot: ItemSlot) {
		super(parent, 'item-picker-root');

		this.gearPicker = gearPicker;
		this.simUI = simUI;
		this.player = player;
		this.slot = slot;
		this.itemElem = new ItemRenderer(parent, this.rootElem, player, { slot });

		this.item = player.getEquippedItem(slot);

		player.sim.waitForInit().then(() => {
			const openGearSelector = (event: Event) => {
				event.preventDefault();
				this.openSelectorModal(SelectorModalTabs.Items);
			};
			const openReforgeSelector = (event: Event) => {
				event.preventDefault();
				this.openSelectorModal(SelectorModalTabs.Reforging);
			};
			const openTinkerSelector = (event: Event) => {
				event.preventDefault();
				this.openSelectorModal(SelectorModalTabs.Tinkers);
			};

			this.itemElem.iconElem.addEventListener('click', openGearSelector);
			this.itemElem.nameElem.addEventListener('click', openGearSelector);
			this.itemElem.reforgeElem.addEventListener('click', openReforgeSelector);
			this.itemElem.tinkerElem.addEventListener('click', openTinkerSelector);
			this.simInitialized = true;
			this.addQuickEnchantHelpers();
		});

		subscribePlayerField(
			player,
			'gear',
		)(() => {
			this.item = this.player.getEquippedItem(this.slot);
			if (this._equippedItem) {
				// The slot may have been empty at sim init, in which case the popover is built here.
				this.addQuickEnchantHelpers();
				if (this._equippedItem !== this.quickSwapEnchantPopover?.item) {
					this.quickSwapEnchantPopover?.update({ item: this._equippedItem });
				}
				this.addQuickGemHelpers();
			}
		});

		subscribeSimField(
			player.sim,
			'filters',
		)(() => {
			if (this._equippedItem) {
				this.quickSwapEnchantPopover?.update({ item: this._equippedItem });
				this.quickSwapGemPopover.forEach(quickSwap => quickSwap.update({ item: this._equippedItem! }));
			}
		});

		subscribeUiField(
			player.sim,
			'showQuickSwap',
		)(() => {
			this.quickSwapEnchantPopover?.tooltip?.[this.player.sim.getShowQuickSwap() ? 'enable' : 'disable']();
			this.quickSwapGemPopover.forEach(quickSwap => quickSwap.tooltip?.[this.player.sim.getShowQuickSwap() ? 'enable' : 'disable']());
		});

		subscribeAll([subscribePlayerField(player, 'profession1'), subscribePlayerField(player, 'profession2')])(() => {
			if (!!this._equippedItem) {
				setEquippedItemWowheadData(this.player, this._equippedItem, [this.itemElem.iconElem, this.itemElem.nameElem]);
			}
		});
	}

	createGearData(): GearData {
		return {
			equipItem: (equippedItem: EquippedItem | null) => {
				this.player.equipItem(this.slot, equippedItem);
			},
			getEquippedItem: () => this.player.getEquippedItem(this.slot)?.withChallengeMode(this.player.getChallengeModeEnabled()).withDynamicStats() || null,
			subscribe: subscribePlayerField(this.player, 'gear'),
		};
	}

	get item(): EquippedItem | null {
		return this._equippedItem;
	}

	set item(newItem: EquippedItem | null) {
		// Clear quick swap gems array since gem sockets are rerendered every time
		this.quickSwapGemPopover = [];
		this.itemElem.render(newItem);

		this._equippedItem = newItem;
		this.onUpdateCallbacks.forEach(callback => callback());
	}

	onUpdate(callback: () => void) {
		this.onUpdateCallbacks.push(callback);
	}

	openSelectorModal(selectedTab: SelectorModalTabs) {
		this.gearPicker.selectorModal.openTab(this.slot, selectedTab, this.createGearData());
	}

	private addQuickGemHelpers() {
		if (!this._equippedItem) return;
		const openGemDetailTab = (socketIdx: number) => this.openSelectorModal(`Gem${socketIdx + 1}` as SelectorModalTabs);
		this.itemElem.socketsElem?.forEach(element => {
			const socketIdx = Number(element.dataset.socketIdx) || 0;
			element.addEventListener('click', event => {
				event.preventDefault();
				openGemDetailTab(0);
			});
			const popover = addQuickGemPopover(this.player, element, this._equippedItem!, this.slot, socketIdx, () => openGemDetailTab(socketIdx));
			if (!this.player.sim.getShowQuickSwap()) popover.tooltip?.disable();
			this.quickSwapGemPopover.push(popover);
		});
	}

	private addQuickEnchantHelpers() {
		if (!this.simInitialized || this.quickSwapEnchantPopover || !this._equippedItem) return;
		const openEnchantSelector = () => this.openSelectorModal(SelectorModalTabs.Enchants);
		this.itemElem.enchantElem.addEventListener('click', event => {
			event?.preventDefault();
			openEnchantSelector();
		});
		this.quickSwapEnchantPopover = addQuickEnchantPopover(this.player, this.itemElem.enchantElem, this._equippedItem, this.slot, openEnchantSelector);
		if (!this.player.sim.getShowQuickSwap()) this.quickSwapEnchantPopover.tooltip?.disable();
	}
}