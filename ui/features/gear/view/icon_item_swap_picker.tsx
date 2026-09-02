import { ItemSlot } from '@core/proto/common';
import { SimUI } from '@core/sim_ui';
import { Player } from '@domain/player';
import { EquippedItem } from '@domain/proto_utils/equipped_item';
import { EventID } from '@domain/state/batch';
import { subscribeAll, subscribePlayerField } from '@domain/state/subscriptions';
import { Component } from '@ui-kit/component';
import { ref } from 'tsx-vanilla';

import { fillAndSetActionId, setEquippedItemWowheadData } from './action_id_dom';
import { GearData } from './item_list';
import SelectorModal, { SelectorModalTabs } from './selector_modal';
import { createGemContainer, getEmptySlotIconUrl } from './utils';
export default class IconItemSwapPicker extends Component {
	private readonly iconAnchor: HTMLAnchorElement;
	private readonly socketsContainerElem: HTMLElement;
	private readonly player: Player<any>;
	private readonly slot: ItemSlot;

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
		this.iconAnchor.style.backgroundImage = `url('${getEmptySlotIconUrl(this.slot)}')`;
		this.iconAnchor.removeAttribute('data-wowhead');
		this.iconAnchor.href = '#';

		if (newItem) {
			fillAndSetActionId(newItem.asActionId(), this.iconAnchor, true, true);
			setEquippedItemWowheadData(this.player, newItem, this.iconAnchor);

			this.socketsContainerElem.replaceChildren(
				<>
					{newItem.allSocketColors().map((socketColor, gemIdx) => {
						const gemContainer = createGemContainer(socketColor, newItem.gems[gemIdx], gemIdx);
						if (gemIdx === newItem.numPossibleSockets - 1 && newItem.couldHaveExtraSocket()) {
							const updateProfession = () => {
								gemContainer.classList[this.player.isBlacksmithing() ? 'remove' : 'add']('hide');
							};
							subscribeAll([subscribePlayerField(this.player, 'profession1'), subscribePlayerField(this.player, 'profession2')])(
								updateProfession,
							);
							updateProfession();
						}
						return gemContainer;
					})}
				</>,
			);

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
