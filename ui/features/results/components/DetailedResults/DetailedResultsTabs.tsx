import { Tabs } from '@base-ui/react/tabs';
import i18n from '@i18n/config';
import clsx from 'clsx';

import { type DetailedResultsTabConfig, tabButtonId } from './utils';

export interface DetailedResultsTabsProps {
	tabs: ReadonlyArray<DetailedResultsTabConfig>;
}

export const DetailedResultsTabs = ({ tabs }: DetailedResultsTabsProps) => (
	<Tabs.List className="nav nav-tabs" activateOnFocus render={<ul />}>
		{tabs.map(tab => (
			<li key={tab.id} className={clsx('nav-item dr-tab-tab', tab.className)} role="presentation">
				{/* `aria-controls` is set here because `Tabs.Panel` registers a generated id rather than the one it renders, so Base UI's own value would point at nothing. */}
				<Tabs.Tab value={tab.id} id={tabButtonId(tab.id)} aria-controls={tab.id} className={state => clsx('nav-link', state.active && 'active')}>
					{i18n.t(tab.labelKey)}
				</Tabs.Tab>
			</li>
		))}
	</Tabs.List>
);
