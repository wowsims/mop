import i18n from '@i18n/config';
import type { SimUIHost } from '@sim/sim_host';
import { SimTab } from '@ui-kit/sim_tab';
import { SimTabPane } from '@ui-kit/SimTabPane';
import { createElement } from 'react';

import { GearTabBody } from './GearTabBody';

const IDENTIFIER = 'gear-tab';

export class GearTab extends SimTab {
	constructor(simUI: SimUIHost) {
		super(simUI, {
			identifier: IDENTIFIER,
			title: i18n.t('gear_tab.title'),
			pane: createElement(SimTabPane, { id: IDENTIFIER, children: createElement(GearTabBody) }),
		});
	}
}
