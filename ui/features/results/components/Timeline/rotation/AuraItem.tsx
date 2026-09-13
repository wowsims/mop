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
		className={clsx('rotation-item rotation-item-aura', item.sharesRowWithCast && 'shares-row')}
		data-item-index={index}
		style={spanStyle(item.start, item.end - item.start)}>
		{item.stacks.map((segment, at) => (
			<AuraStack key={at} segment={segment} />
		))}
	</div>
);
