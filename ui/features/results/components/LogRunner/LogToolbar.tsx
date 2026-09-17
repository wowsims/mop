import i18n from '@i18n/config';
import { Drawer } from '@ui-kit/Drawer';
import { Icon } from '@ui-kit/Icon';
import { Toolbar, ToolbarButton } from '@ui-kit/Toolbar';
import clsx from 'clsx';
import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';

import type { SuggestionSource } from '../../model/log/search/indexes';
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
	const [expanded, setExpanded] = useState(false);
	const [stuck, setStuck] = useState(false);
	const rootRef = useRef<HTMLDivElement>(null);

	// Same observer as the rotation's bar, for the same reason: built inside the hidden Results tab,
	// the ratio goes 0 -> pinned without passing through 1, so [1] alone never fires again.
	//
	// The **last** entry. One delivery can carry several records, and the list
	// growing under a bar that was already pinned produces exactly that pair — the short pane's
	// `ratio: 1` followed by the tall pane's `0.98`. Reading the first leaves the bar unpinned for
	// good, because nothing moves again to produce another record. Measured: with `[entry]` the log
	// pane lost `stuck` on four of six specs, at random.
	useEffect(() => {
		const element = rootRef.current;
		if (!element) return;
		const observer = new IntersectionObserver(
			entries => {
				const entry = entries[entries.length - 1];
				setStuck(entry.target.clientHeight > 0 && entry.intersectionRatio < 1);
			},
			{
				rootMargin: '0px 0px -1px 0px',
				threshold: [0, 1],
			},
		);
		observer.observe(element);
		return () => observer.disconnect();
	}, []);

	const labels = groups
		.filter(group => group.values.length > 0)
		.map(group => `${sentenceCase(group.field)}: ${group.values.map(value => labelOf(group.field, value)).join(', ')}`);

	return (
		<div ref={rootRef} data-testid="log-floating-action-bar-root" className="group ui-fab-root ui-log-fab-bar" data-stuck={stuck ? '' : undefined}>
			<Toolbar testId="log-fab-actions" className="relative min-w-0 flex-1 flex-nowrap items-center gap-2 overflow-x-auto group-data-stuck:bg-background">
				<Drawer
					open={expanded}
					onOpenChange={setExpanded}
					modal={false}
					ignoreOutsidePress={event => !!rootRef.current?.contains(event.target as Node)}
					className="ui-fab-sheet ui-log-fab-sheet"
					testId="log-fab-panel-inner"
					trigger={
						<ToolbarButton
							testId="log-fab-toggle"
							className={clsx('flex items-center gap-2', 'ui-fab-toggle')}
							aria-label={i18n.t('results_tab.details.logs.floatingActionBar.toggle')}>
							<Icon name="filter" />
							<span data-testid="log-fab-summary">
								{labels.length
									? i18n.t('results_tab.details.logs.floatingActionBar.active', { count: labels.length })
									: i18n.t('results_tab.details.logs.floatingActionBar.none')}
							</span>
							<span data-testid="log-fab-preview" className="truncate opacity-75">
								{labels.length ? `${labels.slice(0, PREVIEW_LIMIT).join(', ')}${labels.length > PREVIEW_LIMIT ? ', …' : ''}` : ''}
							</span>
						</ToolbarButton>
					}>
					<div data-testid="log-fab-filters" className="ui-fab-drawer">
						<LogSearchBar groups={groups} suggestions={suggestions} onChange={onChange} />
					</div>
				</Drawer>
				<ToolbarButton
					variant="link-danger"
					size="sm"
					testId="log-fab-clear"
					className={clsx(labels.length === 0 && 'hidden')}
					hidden={labels.length === 0}
					onClick={() => onChange([])}>
					<Icon name="times" className="mr-1" />
					{i18n.t('results_tab.details.logs.floatingActionBar.clear')}
				</ToolbarButton>
				<div data-testid="log-fab-controls" className="flex items-center gap-2 md:ml-auto">
					{children}
				</div>
			</Toolbar>
		</div>
	);
};
