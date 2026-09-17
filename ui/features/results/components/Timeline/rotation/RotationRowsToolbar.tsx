import i18n from '@i18n/config';
import { Icon } from '@ui-kit/Icon';
import { useMemo } from 'react';

import type { ContentRow, RotationModel, Section } from '../../../model/timeline/rotation';
import { rowAt } from '../../../model/timeline/rotation';
import { FloatingActionBar } from '../../FloatingActionBar';
import { RotationFloatingActionBarGroup } from './RotationFloatingActionBarGroup';

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

	return (
		<FloatingActionBar
			testIdPrefix="rotation"
			rootClassName="ui-rotation-floating-action-bar [transition:padding_150ms_ease-in-out,border-width_150ms_ease-in-out]"
			sheetClassName="ui-rotation-floating-action-bar-sheet"
			toggleLabel={i18n.t('results_tab.details.timeline.floatingActionBar.toggle')}
			icon={<Icon name="eye-slash" />}
			summary={
				hiddenKeys.length
					? i18n.t('results_tab.details.timeline.floatingActionBar.hidden', { count: hiddenKeys.length })
					: i18n.t('results_tab.details.timeline.floatingActionBar.allShown')
			}
			preview={preview.length ? `${preview.join(', ')}${hiddenKeys.length > preview.length ? ', …' : ''}` : ''}
			clear={{
				testId: 'rotation-floating-action-bar-show-all',
				className: 'ml-auto',
				icon: <Icon name="times" className="mr-1" />,
				label: i18n.t('results_tab.details.timeline.floatingActionBar.showAll'),
				hidden: hiddenKeys.length === 0,
				onClick: onShowAll,
			}}>
			<div className="ui-floating-action-bar-drawer flex flex-col gap-4">
				{groups.map(group => (
					<RotationFloatingActionBarGroup key={group.id} title={group.title} rows={group.rows} hidden={hidden} onToggle={onToggle} />
				))}
			</div>
		</FloatingActionBar>
	);
};
