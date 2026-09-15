import clsx from 'clsx';

import type { AuraStackSegment } from '../../../model/timeline/rotation';
import { spanStyle } from './utils';

export interface AuraStackProps {
	segment: AuraStackSegment;
	indent?: boolean;
}

export const AuraStack = ({ segment, indent }: AuraStackProps) => (
	<div
		data-testid="rotation-item-stacks"
		className={clsx(
			'ui-timeline-item ui-timeline-item-slice top-0 group-data-[density=coarse]/scroller:hidden group-data-[density=medium]/scroller:hidden',
			indent && 'indent-7.5',
		)}
		style={spanStyle(segment.offset, segment.duration)}>
		{segment.stacks}
	</div>
);
