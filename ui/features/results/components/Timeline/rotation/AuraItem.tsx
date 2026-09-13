import clsx from 'clsx';

import type { AuraItem as AuraItemModel } from '../../../model/timeline/rotation';
import { AuraStack } from './AuraStack';
import { spanStyle } from './utils';

export interface AuraItemProps {
	item: AuraItemModel;
	index: number;
}

export const AuraItem = ({ item, index }: AuraItemProps) => (
	<div
		className={clsx(
			'ui-timeline-item rotation-item-aura top-(--rotation-item-top) min-w-[calc(var(--pps)*var(--dur))] h-(--rotation-item-h) bg-timeline-aura opacity-50',
			item.sharesRowWithCast && 'shares-row',
		)}
		data-item-index={index}
		style={spanStyle(item.start, item.end - item.start)}>
		{item.stacks.map((segment, at) => (
			<AuraStack key={at} segment={segment} indent={item.sharesRowWithCast} />
		))}
	</div>
);
