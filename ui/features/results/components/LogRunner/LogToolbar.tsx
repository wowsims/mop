import i18n from '@i18n/config';
import { Icon } from '@ui-kit/Icon';
import type { ReactNode } from 'react';

import type { SuggestionSource } from '../../model/log/search/indexes';
import { FloatingActionBar } from '../FloatingActionBar';
import { LogSearchBar } from './LogSearchBar';
import type { IdentifiedSearchGroup } from './utils';
import { labelOf, sentenceCase } from './utils';

const PREVIEW_LIMIT = 3;

export interface LogToolbarProps {
	groups: ReadonlyArray<IdentifiedSearchGroup>;
	suggestions: SuggestionSource;
	onChange: (groups: Array<IdentifiedSearchGroup>) => void;
	/** The bar's right-hand controls — export, back to top, the debug toggle. */
	children?: ReactNode;
}

export const LogToolbar = ({ groups, suggestions, onChange, children }: LogToolbarProps) => {
	const labels = groups
		.filter(group => group.values.length > 0)
		.map(group => `${sentenceCase(group.field)}: ${group.values.map(value => labelOf(group.field, value)).join(', ')}`);

	return (
		<FloatingActionBar
			testIdPrefix="log"
			rootClassName="ui-log-floating-action-bar"
			sheetClassName="ui-floating-action-bar-sheet ui-log-floating-action-bar-sheet"
			toolbarClassName="gap-2"
			toggleLabel={i18n.t('results_tab.details.logs.floatingActionBar.toggle')}
			icon={<Icon name="filter" />}
			summary={
				labels.length
					? i18n.t('results_tab.details.logs.floatingActionBar.active', { count: labels.length })
					: i18n.t('results_tab.details.logs.floatingActionBar.none')
			}
			preview={labels.length ? `${labels.slice(0, PREVIEW_LIMIT).join(', ')}${labels.length > PREVIEW_LIMIT ? ', …' : ''}` : ''}
			clear={{
				testId: 'log-floating-action-bar-clear',
				icon: <Icon name="times" className="mr-1" />,
				label: i18n.t('results_tab.details.logs.floatingActionBar.clear'),
				hidden: labels.length === 0,
				onClick: () => onChange([]),
			}}
			controls={
				<div data-testid="log-floating-action-bar-controls" className="flex items-center gap-2 md:ml-auto">
					{children}
				</div>
			}>
			<div data-testid="log-floating-action-bar-filters" className="ui-floating-action-bar-drawer">
				<LogSearchBar groups={groups} suggestions={suggestions} onChange={onChange} />
			</div>
		</FloatingActionBar>
	);
};
