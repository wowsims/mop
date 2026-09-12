import clsx from 'clsx';

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
		className={clsx('rotation-item rotation-item-cast', `outcome-${item.outcome}`, item.cancelled && 'cast-cancelled')}
		data-item-index={index}
		style={spanStyle(item.start, item.end - item.start)}>
		<div
			className="rotation-item-travel"
			hidden={item.travelStart == null}
			style={item.travelStart == null ? undefined : spanStyle(item.travelStart, item.travelDuration ?? 0)}
		/>
		<a className="rotation-item-icon" style={iconUrl ? { backgroundImage: `url('${iconUrl}')` } : undefined} />
	</div>
);
