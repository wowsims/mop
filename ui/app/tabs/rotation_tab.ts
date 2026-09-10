import i18n from '@i18n/config';
import { SimTab } from '@ui-kit/sim_tab';
import { createElement } from 'react';

import { IndividualSimUI } from '../individual_sim_ui';
import { RotationTabPane } from './RotationTabPane';

export class RotationTab extends SimTab {
	constructor(simUI: IndividualSimUI<any>) {
		super(simUI, { identifier: 'rotation-tab', title: i18n.t('rotation_tab.title'), pane: createElement(RotationTabPane) });
	}

	protected buildTabContent() {}
}
