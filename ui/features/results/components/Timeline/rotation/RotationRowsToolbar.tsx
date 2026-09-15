import i18n from '@i18n/config';
import { Drawer } from '@ui-kit/Drawer';
import { Toolbar, ToolbarButton } from '@ui-kit/Toolbar';
import clsx from 'clsx';
import { useEffect, useMemo, useRef, useState } from 'react';

import type { ContentRow, RotationModel, Section } from '../../../model/timeline/rotation';
import { rowAt } from '../../../model/timeline/rotation';
import { RotationFabGroup } from './RotationFabGroup';

export interface RotationRowsToolbarProps {
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

export const RotationRowsToolbar = ({ model, hidden, onToggle, onShowAll }: RotationRowsToolbarProps) => {
	const rootRef = useRef<HTMLDivElement>(null);
	const [expanded, setExpanded] = useState(false);
	const [stuck, setStuck] = useState(false);

	const groups = useMemo(
		() =>
			!model
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
		[model],
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

	return (
		<div
			ref={rootRef}
			data-testid="rotation-floating-action-bar-root"
			className="group ui-fab-root ui-rotation-fab-bar [transition:padding_150ms_ease-in-out,border-width_150ms_ease-in-out]"
			data-stuck={stuck ? '' : undefined}>
			<Toolbar testId="rotation-fab-actions" className="relative min-w-0 flex-1 flex-nowrap items-center overflow-x-auto group-data-stuck:bg-background">
				<Drawer
					open={expanded}
					onOpenChange={setExpanded}
					modal={false}
					ignoreOutsidePress={event => !!rootRef.current?.contains(event.target as Node)}
					className="ui-fab-sheet ui-rotation-fab-sheet"
					testId="rotation-fab-panel-inner"
					trigger={
						<ToolbarButton
							testId="rotation-fab-toggle"
							className={clsx('flex items-center gap-2', 'ui-fab-toggle')}
							aria-label={i18n.t('results_tab.details.timeline.floatingActionBar.toggle')}>
							<i className="fas fa-eye-slash" />
							<span data-testid="rotation-fab-summary">
								{hiddenKeys.length
									? i18n.t('results_tab.details.timeline.floatingActionBar.hidden', { count: hiddenKeys.length })
									: i18n.t('results_tab.details.timeline.floatingActionBar.allShown')}
							</span>
							<span data-testid="rotation-fab-preview" className="truncate opacity-75">
								{preview.length ? `${preview.join(', ')}${hiddenKeys.length > preview.length ? ', …' : ''}` : ''}
							</span>
						</ToolbarButton>
					}>
					<div className="ui-fab-drawer flex flex-col gap-4">
						{groups.map(group => (
							<RotationFabGroup key={group.id} title={group.title} rows={group.rows} hidden={hidden} onToggle={onToggle} />
						))}
					</div>
				</Drawer>
				<ToolbarButton
					variant="link-danger"
					size="sm"
					testId="rotation-fab-show-all"
					className={clsx('ml-auto', hiddenKeys.length === 0 && 'hidden')}
					hidden={hiddenKeys.length === 0}
					onClick={onShowAll}>
					<i className="fas fa-times mr-1" />
					{i18n.t('results_tab.details.timeline.floatingActionBar.showAll')}
				</ToolbarButton>
			</Toolbar>
		</div>
	);
};
