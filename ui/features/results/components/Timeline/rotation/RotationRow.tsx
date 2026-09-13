import { useActionId } from '@ui-kit/hooks/useActionId';
import clsx from 'clsx';
import { memo } from 'react';

import type { ContentRow } from '../../../model/timeline/rotation';
import { RotationRowIcon } from './RotationRowIcon';
import { RotationRowLabel } from './RotationRowLabel';
import { RowItemView } from './RowItemView';
import { rowStyle } from './utils';

export interface RotationRowProps {
	row: ContentRow;
	/** The row's item indexes inside the current track window, ascending. */
	items: ReadonlyArray<number>;
	onHide: (key: string) => void;
}

/**
 * Memoised on the row and its item window: a frame that leaves both alone — every vertical scroll,
 * and every horizontal one that does not cross an item's edge — never renders the row again.
 */
export const RotationRow = memo(({ row, items, onHide }: RotationRowProps) => {
	// Every cast in a row is the same action, so the icon is resolved once here rather than per item.
	const { iconUrl } = useActionId(row.kind === 'resource' ? undefined : row.actionId);

	return (
		<div className={clsx('rotation-row', `rotation-row-${row.kind}`)} style={rowStyle(row)} data-row-key={row.key}>
			<RotationRowLabel
				text={row.label}
				icon={
					row.kind === 'resource' ? (
						<a className="rotation-row-icon" style={{ backgroundImage: `url('${row.icon}')` }} />
					) : (
						<RotationRowIcon actionId={row.actionId} tooltip={row.kind === 'aura' ? 'buffAura' : 'spell'} />
					)
				}
				onHide={() => onHide(row.key)}
			/>
			<div className="rotation-row-track">
				{items.map(index => (
					<RowItemView key={index} item={row.items[index]} index={index} iconUrl={iconUrl} cssName={row.kind === 'resource' ? row.cssName : ''} />
				))}
			</div>
		</div>
	);
});
RotationRow.displayName = 'RotationRow';
