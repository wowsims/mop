import i18n from '@i18n/config';
import { SimTab } from '@ui-kit/sim_tab';

import { IndividualSimUI } from '../individual_sim_ui';

/**
 * Registers the settings pane with the tab registry and owns nothing else — its contents are React's,
 * portalled into `contentContainer` by `SimApp` (see `tabs/SettingsTabBody.tsx`). The class stays
 * because `SimTab`'s constructor is what attaches the pane, and attaching has to happen where it
 * always did.
 */
export class SettingsTab extends SimTab {
	constructor(simUI: IndividualSimUI<any>) {
		super(simUI, { identifier: 'settings-tab', title: i18n.t('settings_tab.title') });
	}

	protected buildTabContent() {}
}
