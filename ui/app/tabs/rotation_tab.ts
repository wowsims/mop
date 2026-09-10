import i18n from '@i18n/config';
import type { SimUIHost } from '@sim/sim_host';
import { SimTab } from '@ui-kit/sim_tab';
import { createElement } from 'react';

import { RotationTabPane } from './RotationTabPane';

export class RotationTab extends SimTab {
	constructor(simUI: SimUIHost) {
		super(simUI, { identifier: 'rotation-tab', title: i18n.t('rotation_tab.title'), pane: createElement(RotationTabPane) });
	}
}
