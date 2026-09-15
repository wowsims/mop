import { TIMELINE_SERIES_TEXT } from '@ui-kit/utils/colors';
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

const FILL_CLASSES: Record<string, string> = {
	focus: 'bottom-0 w-2.5 bg-orange',
	energy: 'bottom-0 w-2.5 bg-damage-partial',
	'lunar-energy': 'bottom-0 w-6 bg-resource-lunar-energy',
	'solar-energy': 'top-0 w-6 bg-resource-solar-energy',
};

export const ResourceItem = ({ item, index, cssName }: ResourceItemProps) => (
	<div
		data-testid="series-color"
		className={clsx('ui-timeline-item ui-timeline-item-slice top-0', TIMELINE_SERIES_TEXT[cssName], cssName)}
		data-item-index={index}
		style={spanStyle(item.start, item.end - item.start)}>
		<div
			data-testid="rotation-item-resource-fill"
			className={clsx('absolute left-0 h-timeline-fill', FILL_CLASSES[cssName])}
			hidden={item.display !== 'fill'}
			style={item.display === 'fill' ? cssVars({ '--fill': String(item.fillPercent) }) : undefined}
		/>
		<span data-testid="rotation-item-resource-text" className="group-data-[density=coarse]/scroller:hidden group-data-[density=medium]/scroller:hidden">
			{item.text}
		</span>
	</div>
);
