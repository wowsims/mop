import i18n from '@i18n/config';
import { SimTab } from '@ui-kit/sim_tab';

import { IndividualSimUI } from '../individual_sim_ui';

export class SettingsTab extends SimTab {
	constructor(simUI: IndividualSimUI<any>) {
		super(simUI, { identifier: 'settings-tab', title: i18n.t('settings_tab.title') });
	}

	protected buildTabContent() {}
}
