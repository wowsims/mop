import { cssVars } from '@ui-kit/utils/css';
import clsx from 'clsx';

import type { ResourceItem as ResourceItemModel } from '../../../model/timeline/rotation';
import { spanStyle } from './utils';

export interface ResourceItemProps {
	item: ResourceItemModel;
	index: number;
	/** The row's resource class, which colours both the block and its fill. */
	cssName: string;
}

export const ResourceItem = ({ item, index, cssName }: ResourceItemProps) => (
	<div
		className={clsx('rotation-item rotation-item-resource series-color', cssName)}
		data-item-index={index}
		style={spanStyle(item.start, item.end - item.start)}>
		<div
			className={clsx('rotation-item-resource-fill', cssName)}
			hidden={item.display !== 'fill'}
			style={item.display === 'fill' ? cssVars({ '--fill': String(item.fillPercent) }) : undefined}
		/>
		<span className="rotation-item-resource-text">{item.text}</span>
	</div>
);
