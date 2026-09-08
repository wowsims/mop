import { cssVars } from '@ui-kit/utils/css';

import type { TickItem as TickItemModel } from '../../../view/timeline/rotation/model';

export interface TickItemProps {
	item: TickItemModel;
	index: number;
}

export const TickItem = ({ item, index }: TickItemProps) => (
	<div className="rotation-item rotation-item-tick" data-item-index={index} style={cssVars({ '--t': String(item.start) })} />
);
