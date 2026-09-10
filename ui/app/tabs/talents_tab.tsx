import { Spec } from '@generated/proto/common';
import i18n from '@i18n/config';
import { SimTab } from '@ui-kit/sim_tab';
import { SimTabPane } from '@ui-kit/SimTabPane';

import { IndividualSimUI } from '../individual_sim_ui';
import { TalentsTabBody } from './TalentsTabBody';

const IDENTIFIER = 'talents-tab';

export class TalentsTab<SpecType extends Spec> extends SimTab {
	constructor(simUI: IndividualSimUI<SpecType>) {
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

	protected buildTabContent() {}
}
