import i18n from '@i18n/config';
import { SimTab } from '@ui-kit/sim_tab';
import { SimTabPane } from '@ui-kit/SimTabPane';
import { createElement } from 'react';

import { IndividualSimUI } from '../individual_sim_ui';
import { GearTabBody } from './GearTabBody';

const IDENTIFIER = 'gear-tab';

export class GearTab extends SimTab {
	constructor(simUI: IndividualSimUI<any>) {
		super(simUI, {
			identifier: IDENTIFIER,
			title: i18n.t('gear_tab.title'),
			pane: createElement(SimTabPane, { id: IDENTIFIER, children: createElement(GearTabBody) }),
		});
	}

	protected buildTabContent() {}
}
