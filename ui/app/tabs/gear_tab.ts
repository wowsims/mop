import { subscribePlayerField } from '@sim/state/subscriptions';
import { ALL_ITEM_SLOTS, createGearData } from '@features/gear/model/gear_data';
import type { SelectorModalOpener, SelectorModalTabs, SlotRailEntry } from '@features/gear/types';
import SelectorModal from '@features/gear/view/selector_modal';
import i18n from '@i18n/config';
import { SimTab } from '@ui-kit/sim_tab';

import { IndividualSimUI } from '../individual_sim_ui';

export class GearTab extends SimTab {
	readonly selectorModal: SelectorModalOpener;

	constructor(simUI: IndividualSimUI<any>) {
		super(simUI, { identifier: 'gear-tab', title: i18n.t('gear_tab.title') });

		const player = simUI.player;
		const slotRail: SlotRailEntry[] = ALL_ITEM_SLOTS.map(slot => ({
			slot,
			getItem: () => player.getEquippedItem(slot),
			subscribe: subscribePlayerField(player, 'gear'),
			open: (tab: SelectorModalTabs) => modal.openTab(slot, tab, createGearData(player, slot)),
		}));
		const modal = new SelectorModal(simUI.rootElem, simUI, player, slotRail, { id: 'gear-picker-selector-modal' });

		this.selectorModal = modal;
	}

	protected buildTabContent() {}
}
