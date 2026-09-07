import type { SelectorModalOpener } from '@features/gear/types';
import SelectorModal from '@features/gear/view/selector_modal';
import i18n from '@i18n/config';
import { SimTab } from '@ui-kit/sim_tab';

import { IndividualSimUI } from '../individual_sim_ui';

export class SettingsTab extends SimTab {
	private readonly individualSimUI: IndividualSimUI<any>;
	private itemSwapModal: SelectorModalOpener | null = null;

	constructor(simUI: IndividualSimUI<any>) {
		super(simUI, { identifier: 'settings-tab', title: i18n.t('settings_tab.title') });
		this.individualSimUI = simUI;
	}

	get itemSwapSelectorModal(): SelectorModalOpener {
		this.itemSwapModal ??= new SelectorModal(this.individualSimUI.rootElem, this.individualSimUI, this.individualSimUI.player, undefined, {
			id: 'item-swap-selector-modal',
		});
		return this.itemSwapModal;
	}

	protected buildTabContent() {}
}
