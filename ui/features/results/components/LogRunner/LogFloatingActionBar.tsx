import i18n from '@i18n/config';
import { Icon } from '@ui-kit/Icon';
import clsx from 'clsx';
import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';

import type { SuggestionSource } from '../../model/log/search/indexes';
import { LogSearchBar } from './LogSearchBar';
import type { IdentifiedSearchGroup } from './utils';
import { labelOf, sentenceCase } from './utils';

const PREVIEW_LIMIT = 3;

export interface LogFloatingActionBarProps {
	groups: ReadonlyArray<IdentifiedSearchGroup>;
	suggestions: SuggestionSource;
	onChange: (groups: Array<IdentifiedSearchGroup>) => void;
	/** The bar's right-hand controls — export, back to top, the debug toggle. */
	children?: ReactNode;
}

export const LogFloatingActionBar = ({ groups, suggestions, onChange, children }: LogFloatingActionBarProps) => {
	const [expanded, setExpanded] = useState(false);
	const [stuck, setStuck] = useState(false);
	const rootRef = useRef<HTMLDivElement>(null);
	const toggleRef = useRef<HTMLButtonElement>(null);

	// Same observer as the rotation's bar, for the same reason: built inside the hidden Results tab,
	// the ratio goes 0 -> pinned without passing through 1, so [1] alone never fires again.
	//
	// The **last** entry, not vanilla's first. One delivery can carry several records, and the list
	// growing under a bar that was already pinned produces exactly that pair — the short pane's
	// `ratio: 1` followed by the tall pane's `0.98`. Reading the first leaves the bar unpinned for
	// good, because nothing moves again to produce another record. Measured: with `[entry]` the log
	// pane lost `stuck` on four of six specs in `results-tabs.mjs`, at random.
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
		<div
			ref={rootRef}
			className={clsx('log-floating-action-bar-root', stuck && 'stuck')}
			data-expanded={String(expanded)}
			onKeyDown={event => {
				if (event.key !== 'Escape' || !expanded) return;
				setExpanded(false);
				toggleRef.current?.focus();
				event.preventDefault();
			}}>
			<div className="log-fab-clip">
				<div className="log-fab-panel">
					{/* The clip wrapper only hides the collapsed panel; inert is what takes it out of the tab order. */}
					<div className="log-fab-panel-inner" inert={!expanded}>
						<div className="log-fab-filters">
							<LogSearchBar groups={groups} suggestions={suggestions} onChange={onChange} />
						</div>
					</div>
				</div>
			</div>
			<div className="log-fab-actions">
				<button
					ref={toggleRef}
					type="button"
					className="btn btn-primary log-fab-toggle"
					aria-expanded={expanded}
					aria-label={i18n.t('results_tab.details.logs.floatingActionBar.toggle')}
					onClick={() => setExpanded(current => !current)}>
					<Icon name="filter" />
					<span className="log-fab-summary">
						{labels.length
							? i18n.t('results_tab.details.logs.floatingActionBar.active', { count: labels.length })
							: i18n.t('results_tab.details.logs.floatingActionBar.none')}
					</span>
					<span className="log-fab-preview">
						{labels.length ? `${labels.slice(0, PREVIEW_LIMIT).join(', ')}${labels.length > PREVIEW_LIMIT ? ', …' : ''}` : ''}
					</span>
				</button>
				<button type="button" className="btn btn-sm btn-link btn-reset log-fab-clear" hidden={labels.length === 0} onClick={() => onChange([])}>
					<Icon name="times" className="me-1" />
					{i18n.t('results_tab.details.logs.floatingActionBar.clear')}
				</button>
				<div className="log-fab-controls">{children}</div>
			</div>
		</div>
	);
};
