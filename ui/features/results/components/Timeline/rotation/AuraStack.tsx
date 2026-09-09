import type { AuraStackSegment } from '../../../model/timeline/rotation';
import { spanStyle } from './utils';

export interface AuraStackProps {
	segment: AuraStackSegment;
}

export const AuraStack = ({ segment }: AuraStackProps) => (
	<div className="rotation-item rotation-item-stacks" style={spanStyle(segment.offset, segment.duration)}>
		{segment.stacks}
	</div>
);
