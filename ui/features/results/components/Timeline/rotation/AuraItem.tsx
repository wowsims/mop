import type { AuraItem as AuraItemModel } from '../../../model/timeline/rotation';
import { AuraStack } from './AuraStack';
import { spanStyle } from './utils';

export interface AuraItemProps {
	item: AuraItemModel;
	index: number;
}

export const AuraItem = ({ item, index }: AuraItemProps) => (
	<div
		className="ui-timeline-item top-(--rotation-item-top) h-(--rotation-item-h) min-w-timeline-segment bg-timeline-aura opacity-50"
		data-shares-row={item.sharesRowWithCast ? '' : undefined}
		data-item-index={index}
		style={spanStyle(item.start, item.end - item.start)}>
		{item.stacks.map((segment, at) => (
			<AuraStack key={at} segment={segment} indent={item.sharesRowWithCast} />
		))}
	</div>
);
