import { cssVars } from '@ui-kit/utils/css';

import type { TickItem as TickItemModel } from '../../../model/timeline/rotation';

export interface TickItemProps {
	item: TickItemModel;
	index: number;
}

export const TickItem = ({ item, index }: TickItemProps) => (
	<div
		data-testid="rotation-item-tick"
		className="ui-timeline-item top-(--rotation-item-top) z-2 h-(--rotation-item-h) w-1.25 bg-maroon"
		data-item-index={index}
		style={cssVars({ '--t': String(item.start) })}
	/>
);
