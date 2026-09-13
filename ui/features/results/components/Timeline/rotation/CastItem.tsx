import { WowheadIcon } from '@ui-kit/WowheadIcon';

import type { CastItem as CastItemModel } from '../../../model/timeline/rotation';
import { spanStyle } from './utils';

export interface CastItemProps {
	item: CastItemModel;
	index: number;
	/** Resolved once by the row: every cast in a row is the same action. */
	iconUrl: string;
}

export const CastItem = ({ item, index, iconUrl }: CastItemProps) => (
	<div
		className="ui-timeline-item rotation-item-cast group/cast top-(--rotation-item-top) z-1 flex h-(--rotation-item-h) min-w-[calc(var(--pps)*var(--dur))] items-center bg-timeline-cast data-[outcome=cancelled]:bg-timeline-cast-cancelled group-data-[density=coarse]/scroller:min-w-[max(2px,calc(var(--pps)*var(--dur)))] group-data-[density=coarse]/scroller:bg-gray-700 group-data-[density=coarse]/scroller:data-[outcome=hit]:bg-damage-hit group-data-[density=coarse]/scroller:data-[outcome=crit]:bg-damage-crit group-data-[density=coarse]/scroller:data-[outcome=miss]:bg-damage-miss group-data-[density=coarse]/scroller:data-[outcome=partial]:bg-damage-partial group-data-[density=coarse]/scroller:data-[outcome=cancelled]:bg-cancel"
		data-item-index={index}
		data-outcome={item.cancelled ? 'cancelled' : item.outcome}
		style={spanStyle(item.start, item.end - item.start)}>
		<div
			className="rotation-item-travel absolute top-0 left-[calc(var(--pps)*var(--t))] h-(--rotation-item-h) min-w-[calc(var(--pps)*var(--dur))] bg-timeline-travel"
			hidden={item.travelStart == null}
			style={item.travelStart == null ? undefined : spanStyle(item.travelStart, item.travelDuration ?? 0)}
		/>
		<WowheadIcon
			className="rotation-item-icon h-(--rotation-item-h) w-(--rotation-item-h) flex-none border-b-[3px] border-gray-600 group-data-[outcome=miss]/cast:border-damage-miss group-data-[outcome=partial]/cast:border-damage-partial group-data-[outcome=hit]/cast:border-damage-hit group-data-[outcome=crit]/cast:border-damage-crit group-data-[outcome=cancelled]/cast:border-cancel group-data-[density=coarse]/scroller:hidden"
			iconUrl={iconUrl}
		/>
	</div>
);
