import { DetailedResults } from '@features/results/components/DetailedResults';
import i18n from '@i18n/config';
import { SimTabPane } from '@ui-kit/SimTabPane';
import { memo } from 'react';

import type { SimHostObject } from './individual_sim_ui';
import { SimTabDef } from './SimTabDef';
import { SimTabs } from './SimTabs';
import { BulkTabBody } from './tabs/BulkTabBody';
import { GearTabBody } from './tabs/GearTabBody';
import { RotationTabPane } from './tabs/RotationTabPane';
import { SettingsTabBody } from './tabs/SettingsTabBody';
import { TalentsTabBody } from './tabs/TalentsTabBody';

export interface SimTabsSectionProps {
	host: SimHostObject<any>;
}

// `memo`, because the panes are elements again on every render of this component and three of them
// are heavy: without it, opening the settings dialog re-renders all six.
export const SimTabsSection = memo(({ host }: SimTabsSectionProps) => (
	<SimTabs activation={host.tabs} panes={host.simTabContentsContainer}>
		<SimTabDef id="gear-tab" title={i18n.t('gear_tab.title')}>
			<SimTabPane id="gear-tab">
				<GearTabBody />
			</SimTabPane>
		</SimTabDef>
		<SimTabDef id="settings-tab" title={i18n.t('settings_tab.title')}>
			<SimTabPane id="settings-tab">
				<SettingsTabBody />
			</SimTabPane>
		</SimTabDef>
		<SimTabDef id="talents-tab" title={i18n.t('talents_tab.title')}>
			<SimTabPane id="talents-tab">
				<TalentsTabBody />
			</SimTabPane>
		</SimTabDef>
		<SimTabDef id="rotation-tab" title={i18n.t('rotation_tab.title')}>
			<RotationTabPane />
		</SimTabDef>
		{/* Not a `SimTabPane`: the doubled id and the missing content container are what the vanilla `addTab` built here, and the stylesheets and gates select on both. */}
		<SimTabDef id="detailed-results-tab-tab" title={i18n.t('results_tab.title')}>
			<div id="detailed-results-tab-tab" className="sim-tab">
				<div className="detailed-results">
					<DetailedResults resultsManager={host.raidSimResultsManager} />
				</div>
			</div>
		</SimTabDef>
		<SimTabDef id="bulk-tab" title={i18n.t('bulk_tab.title')} badge={i18n.t('bulk_tab.title_badge')}>
			<SimTabPane id="bulk-tab">
				<BulkTabBody />
			</SimTabPane>
		</SimTabDef>
	</SimTabs>
));
