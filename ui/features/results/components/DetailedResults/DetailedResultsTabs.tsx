import i18n from '@i18n/config';
import clsx from 'clsx';
import type { KeyboardEvent } from 'react';

import { type DetailedResultsTabConfig, nextTabByKey, tabButtonId } from './utils';

export interface DetailedResultsTabsProps {
	tabs: ReadonlyArray<DetailedResultsTabConfig>;
	activeId: string;
	onSelect: (id: string) => void;
}

export const DetailedResultsTabs = ({ tabs, activeId, onSelect }: DetailedResultsTabsProps) => {
	const onKeyDown = (event: KeyboardEvent<HTMLUListElement>) => {
		// From the *focused* tab, as Bootstrap's `_keydown` did. The roving tabindex makes that the selected one in ordinary use, but focus can be moved to another tab without selecting it.
		const focused = (event.target as HTMLElement).closest('[role=tab]')?.getAttribute('aria-controls');
		const next = nextTabByKey(tabs, focused ?? activeId, event.key);
		if (!next) return;
		event.preventDefault();
		event.stopPropagation();
		onSelect(next);
		document.getElementById(tabButtonId(next))?.focus({ preventScroll: true });
	};

	return (
		<ul className="nav nav-tabs" role="tablist" onKeyDown={onKeyDown}>
			{tabs.map(tab => {
				const isActive = tab.id === activeId;
				return (
					<li key={tab.id} className={clsx('nav-item dr-tab-tab', tab.className)} role="presentation">
						<button
							id={tabButtonId(tab.id)}
							className={clsx('nav-link', isActive && 'active')}
							type="button"
							role="tab"
							aria-controls={tab.id}
							aria-selected={isActive}
							tabIndex={isActive ? undefined : -1}
							onClick={() => onSelect(tab.id)}>
							{i18n.t(tab.labelKey)}
						</button>
					</li>
				);
			})}
		</ul>
	);
};
