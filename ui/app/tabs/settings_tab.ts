import { GearSelectorModalOpener } from '@features/gear/model/selector_modal_opener';
import i18n from '@i18n/config';
import { SimTab } from '@ui-kit/sim_tab';
import { SimTabPane } from '@ui-kit/SimTabPane';
import { createElement } from 'react';

import { IndividualSimUI } from '../individual_sim_ui';
import { SettingsTabBody } from './SettingsTabBody';

const IDENTIFIER = 'settings-tab';

export class SettingsTab extends SimTab {
	/** The swap slots' gear selector. `SettingsTabBody` renders the railless dialog behind it. */
	readonly itemSwapSelectorModal = new GearSelectorModalOpener();

	constructor(simUI: IndividualSimUI<any>) {
		super(simUI, {
			identifier: IDENTIFIER,
			title: i18n.t('settings_tab.title'),
			pane: createElement(SimTabPane, { id: IDENTIFIER, children: createElement(SettingsTabBody) }),
		});
	}

	protected buildTabContent() {}
}
