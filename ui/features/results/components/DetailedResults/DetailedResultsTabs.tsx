import i18n from '@i18n/config';
import { TabNav } from '@ui-kit/TabNav';

import { type DetailedResultsTabConfig, tabButtonId } from './utils';

export interface DetailedResultsTabsProps {
	tabs: ReadonlyArray<DetailedResultsTabConfig>;
}

export const DetailedResultsTabs = ({ tabs }: DetailedResultsTabsProps) => (
	<TabNav
		bordered={false}
		className="ml-auto min-h-0"
		tabs={tabs.map(tab => ({ id: tab.id, label: i18n.t(tab.labelKey), className: tab.className, tabId: tabButtonId(tab.id) }))}
	/>
);
