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
		data-testid="rotation-item-cast"
		className="ui-timeline-item group/cast top-(--rotation-item-top) z-1 flex h-(--rotation-item-h) min-w-timeline-segment items-center bg-timeline-cast group-data-[density=coarse]/scroller:min-w-timeline-segment-floor group-data-[density=coarse]/scroller:bg-gray-700 data-[outcome=cancelled]:bg-timeline-cast-cancelled group-data-[density=coarse]/scroller:data-[outcome=cancelled]:bg-cancel group-data-[density=coarse]/scroller:data-[outcome=crit]:bg-damage-crit group-data-[density=coarse]/scroller:data-[outcome=hit]:bg-damage-hit group-data-[density=coarse]/scroller:data-[outcome=miss]:bg-damage-miss group-data-[density=coarse]/scroller:data-[outcome=partial]:bg-damage-partial"
		data-item-index={index}
		data-outcome={item.cancelled ? 'cancelled' : item.outcome}
		style={spanStyle(item.start, item.end - item.start)}>
		<div
			data-testid="rotation-item-travel"
			className="absolute top-0 left-timeline-pos h-(--rotation-item-h) min-w-timeline-segment bg-timeline-travel"
			hidden={item.travelStart == null}
			style={item.travelStart == null ? undefined : spanStyle(item.travelStart, item.travelDuration ?? 0)}
		/>
		<WowheadIcon
			testId="rotation-item-icon"
			className="h-(--rotation-item-h) w-(--rotation-item-h) flex-none border-b-3 border-gray-600 group-data-[density=coarse]/scroller:hidden group-data-[outcome=cancelled]/cast:border-cancel group-data-[outcome=crit]/cast:border-damage-crit group-data-[outcome=hit]/cast:border-damage-hit group-data-[outcome=miss]/cast:border-damage-miss group-data-[outcome=partial]/cast:border-damage-partial"
			iconUrl={iconUrl}
		/>
	</div>
);
