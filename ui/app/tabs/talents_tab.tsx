import i18n from '@i18n/config';
import type { SimUIHost } from '@sim/sim_host';
import { SimTab } from '@ui-kit/sim_tab';
import { SimTabPane } from '@ui-kit/SimTabPane';

import { TalentsTabBody } from './TalentsTabBody';

const IDENTIFIER = 'talents-tab';

export class TalentsTab extends SimTab {
	constructor(simUI: SimUIHost) {
		super(simUI, {
			identifier: IDENTIFIER,
			title: i18n.t('talents_tab.title'),
			pane: (
				<SimTabPane id={IDENTIFIER}>
					<TalentsTabBody />
				</SimTabPane>
			),
		});
	}
}
