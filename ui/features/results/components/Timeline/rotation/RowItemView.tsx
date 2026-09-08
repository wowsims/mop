import { memo } from 'react';

import type { RowItem } from '../../../view/timeline/rotation/model';
import { AuraItem } from './AuraItem';
import { CastItem } from './CastItem';
import { ResourceItem } from './ResourceItem';
import { TickItem } from './TickItem';

export interface RowItemViewProps {
	item: RowItem;
	index: number;
	iconUrl: string;
	cssName: string;
}

/**
 * Memoised because a pan only changes the item window at its edges: every item that was already on
 * screen keeps the same model object and index, so its subtree is never diffed again.
 */
export const RowItemView = memo(({ item, index, iconUrl, cssName }: RowItemViewProps) => {
	switch (item.kind) {
		case 'cast':
			return <CastItem item={item} index={index} iconUrl={iconUrl} />;
		case 'tick':
			return <TickItem item={item} index={index} />;
		case 'aura':
			return <AuraItem item={item} index={index} />;
		case 'resource':
			return <ResourceItem item={item} index={index} cssName={cssName} />;
	}
});
RowItemView.displayName = 'RowItemView';
