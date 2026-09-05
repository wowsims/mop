import { Spec } from '@generated/proto/common';
import i18n from '@i18n/config';
import { SimTab } from '@ui-kit/sim_tab';

import { IndividualSimUI } from '../individual_sim_ui';

/**
 * Registers the talents pane with the tab registry and owns nothing else — its contents are React's,
 * portalled into `contentContainer` by `SimApp` (see `tabs/TalentsTabBody.tsx`). The class stays
 * because `SimTab`'s constructor is what attaches the pane, and attaching has to happen where it
 * always did.
 */
export class TalentsTab<SpecType extends Spec> extends SimTab {
	constructor(simUI: IndividualSimUI<SpecType>) {
		super(simUI, { identifier: 'talents-tab', title: i18n.t('talents_tab.title') });
	}

	protected buildTabContent() {}
}
