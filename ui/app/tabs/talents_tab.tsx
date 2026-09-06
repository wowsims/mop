import { Spec } from '@generated/proto/common';
import i18n from '@i18n/config';
import { SimTab } from '@ui-kit/sim_tab';

import { IndividualSimUI } from '../individual_sim_ui';

export class TalentsTab<SpecType extends Spec> extends SimTab {
	constructor(simUI: IndividualSimUI<SpecType>) {
		super(simUI, { identifier: 'talents-tab', title: i18n.t('talents_tab.title') });
	}

	protected buildTabContent() {}
}
