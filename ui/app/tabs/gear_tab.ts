import i18n from '@i18n/config';
import { SimTab } from '@ui-kit/sim_tab';

import { IndividualSimUI } from '../individual_sim_ui';

export class GearTab extends SimTab {
	constructor(simUI: IndividualSimUI<any>) {
		super(simUI, { identifier: 'gear-tab', title: i18n.t('gear_tab.title') });
	}

	protected buildTabContent() {}
}
