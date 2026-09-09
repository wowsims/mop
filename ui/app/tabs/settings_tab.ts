import { GearSelectorModalOpener } from '@features/gear/model/selector_modal_opener';
import i18n from '@i18n/config';
import { SimTab } from '@ui-kit/sim_tab';

import { IndividualSimUI } from '../individual_sim_ui';

export class SettingsTab extends SimTab {
	/** The swap slots' gear selector. `SettingsTabBody` renders the railless dialog behind it. */
	readonly itemSwapSelectorModal = new GearSelectorModalOpener();

	constructor(simUI: IndividualSimUI<any>) {
		super(simUI, { identifier: 'settings-tab', title: i18n.t('settings_tab.title') });
	}

	protected buildTabContent() {}
}
