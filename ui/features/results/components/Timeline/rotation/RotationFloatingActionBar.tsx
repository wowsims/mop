import i18n from '@i18n/config';
import clsx from 'clsx';
import type { KeyboardEvent } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';

import type { ContentRow, RotationModel, Section } from '../../../model/timeline/rotation';
import { rowAt } from '../../../model/timeline/rotation';
import { RotationFabGroup } from './RotationFabGroup';

export interface RotationFloatingActionBarProps {
	model: RotationModel | null;
	hidden: ReadonlySet<string>;
	onToggle: (key: string) => void;
	onShowAll: () => void;
}

const sectionTitle = (section: Section): string => {
	switch (section.kind) {
		case 'player':
			return 'Player';
		case 'buffs':
			return 'Buffs';
		case 'targetCasts':
			return `${section.label} - Casts`;
		case 'targetDebuffs':
			return `${section.label} - Debuffs`;
		default:
			return section.label;
	}
};

export const RotationFloatingActionBar = ({ model, hidden, onToggle, onShowAll }: RotationFloatingActionBarProps) => {
	const rootRef = useRef<HTMLDivElement>(null);
	const toggleRef = useRef<HTMLButtonElement>(null);
	const [expanded, setExpanded] = useState(false);
	const [stuck, setStuck] = useState(false);
	// The chips are only worth building once someone opens the drawer. A new result then rebuilds them
	// where they stand rather than closing it: a swap between two references is exactly when someone is
	// watching the same row list.
	const [everExpanded, setEverExpanded] = useState(false);

	const groups = useMemo(
		() =>
			!model || !everExpanded
				? []
				: model.sections
						.map(section => ({
							id: section.id,
							title: sectionTitle(section),
							rows: section.rowKeys
								.map(key => rowAt(model, key))
								.filter((row): row is ContentRow => row.kind !== 'header' && row.kind !== 'separator'),
						}))
						.filter(group => group.rows.length > 0),
		[model, everExpanded],
	);

	const hiddenKeys = useMemo(() => [...hidden].filter(key => !!model?.byKey.has(key)), [hidden, model]);
	const preview = hiddenKeys.slice(0, 3).map(key => {
		const row = rowAt(model!, key);
		return row.kind === 'separator' ? '' : row.label;
	});

	// Bottom-sticky mirror of `useStickyToolbar`: the bar only stops fitting whole against the viewport's
	// last pixel once it is actually pinned. The 0 threshold is load-bearing — the bar is built
	// inside the hidden Results tab, so its ratio goes 0 -> pinned without ever passing through 1,
	// and a [1]-only observer is never called again after that first hidden callback.
	useEffect(() => {
		const element = rootRef.current;
		if (!element) return;
		// One delivery can carry several records, oldest first, so the last is the current state — reading `[entry]` leaves the bar stuck on a stale ratio.
		const observer = new IntersectionObserver(entries => setStuck(element.clientHeight > 0 && entries[entries.length - 1].intersectionRatio < 1), {
			rootMargin: '0px 0px -1px 0px',
			threshold: [0, 1],
		});
		observer.observe(element);
		return () => observer.disconnect();
	}, []);

	const open = (next: boolean) => {
		setExpanded(next);
		if (next) setEverExpanded(true);
	};

	const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
		if (event.key !== 'Escape') return;
		open(false);
		toggleRef.current?.focus();
		event.preventDefault();
	};

	return (
		<div ref={rootRef} className={clsx('rotation-floating-action-bar-root', stuck && 'stuck')} data-expanded={String(expanded)} onKeyDown={onKeyDown}>
			<div className="rotation-fab-clip">
				<div className="rotation-fab-panel">
					{/* The clip wrapper only hides the collapsed chips; `inert` is what takes them out of the tab order. */}
					<div className="rotation-fab-panel-inner" inert={!expanded}>
						<div className="rotation-fab-groups">
							{groups.map(group => (
								<RotationFabGroup key={group.id} title={group.title} rows={group.rows} hidden={hidden} onToggle={onToggle} />
							))}
						</div>
					</div>
				</div>
			</div>
			<div className="rotation-fab-actions">
				<button
					ref={toggleRef}
					type="button"
					className="btn btn-primary rotation-fab-toggle"
					aria-expanded={expanded}
					aria-label={i18n.t('results_tab.details.timeline.floatingActionBar.toggle')}
					onClick={() => open(!expanded)}>
					<i className="fas fa-eye-slash" />
					<span className="rotation-fab-summary">
						{hiddenKeys.length
							? i18n.t('results_tab.details.timeline.floatingActionBar.hidden', { count: hiddenKeys.length })
							: i18n.t('results_tab.details.timeline.floatingActionBar.allShown')}
					</span>
					<span className="rotation-fab-preview">
						{preview.length ? `${preview.join(', ')}${hiddenKeys.length > preview.length ? ', …' : ''}` : ''}
					</span>
				</button>
				<button
					type="button"
					className="btn btn-sm btn-link btn-reset ms-auto rotation-fab-show-all"
					hidden={hiddenKeys.length === 0}
					onClick={onShowAll}>
					<i className="fas fa-times me-1" />
					{i18n.t('results_tab.details.timeline.floatingActionBar.showAll')}
				</button>
			</div>
		</div>
	);
};
