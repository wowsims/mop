import { ref } from 'tsx-vanilla';

import { Player } from '../../player';
import { ItemSlot } from '../../proto/common';
import { EquippedItem } from '../../proto_utils/equipped_item';
import { SimUI } from '../../sim_ui';
import { EventID } from '../../state/batch';
import { subscribePlayerField } from '../../state/subscriptions';
import { Component } from '../component';
import { GearData } from './item_list';
import SelectorModal, { SelectorModalTabs } from './selector_modal';
import { createItemSockets, getEmptySlotIconUrl } from './utils';

export default class IconItemSwapPicker extends Component {
	private readonly iconAnchor: HTMLAnchorElement;
	private readonly socketsContainerElem: HTMLElement;
	private readonly player: Player<any>;
	private readonly slot: ItemSlot;
	private professionSubscription: (() => void) | null = null;

	constructor(parent: HTMLElement, simUI: SimUI, player: Player<any>, slot: ItemSlot) {
		super(parent, 'icon-picker-root');
		this.rootElem.classList.add('icon-picker');
		this.player = player;
		this.slot = slot;

		const iconAnchorRef = ref<HTMLAnchorElement>();
		const socketsContainerRef = ref<HTMLDivElement>();

		this.rootElem.prepend(
			<a ref={iconAnchorRef} className="icon-picker-button" href="#" attributes={{ role: 'button' }}>
				<div ref={socketsContainerRef} className="item-picker-sockets-container" />
			</a>,
		);

		this.iconAnchor = iconAnchorRef.value!;
		this.socketsContainerElem = socketsContainerRef.value!;

		const selectorModal = new SelectorModal(simUI.rootElem, simUI, this.player);

		player.sim.waitForInit().then(() => {
			this.iconAnchor.addEventListener('click', (event: Event) => {
				event.preventDefault();
				selectorModal.openTab(this.slot, SelectorModalTabs.Items, this.createGearData());
			});
		});

		subscribePlayerField(
			player,
			'itemSwap',
		)(() => {
			this.update(player.itemSwapSettings.getGear().getEquippedItem(slot));
		});
	}

	update(newItem: EquippedItem | null) {
		this.professionSubscription?.();
		this.professionSubscription = null;
		this.iconAnchor.style.backgroundImage = `url('${getEmptySlotIconUrl(this.slot)}')`;
		this.iconAnchor.removeAttribute('data-wowhead');
		this.iconAnchor.href = '#';

		if (newItem) {
			newItem.asActionId().fillAndSet(this.iconAnchor, true, true);
			this.player.setWowheadData(newItem, this.iconAnchor);

			const sockets = createItemSockets(this.player, newItem);
			this.professionSubscription = sockets.professionSubscription;
			this.socketsContainerElem.replaceChildren(...sockets.elems);

			this.iconAnchor.classList.add('active');
		} else {
			this.socketsContainerElem.replaceChildren();
			this.iconAnchor.classList.remove('active');
		}
	}

	private createGearData(): GearData {
		return {
			equipItem: (eventID: EventID, newItem: EquippedItem | null) => {
				this.player.itemSwapSettings.equipItem(eventID, this.slot, newItem);
			},
			getEquippedItem: () => this.player.itemSwapSettings.getItem(this.slot),
			subscribe: subscribePlayerField(this.player, 'itemSwap'),
		};
	}
}
