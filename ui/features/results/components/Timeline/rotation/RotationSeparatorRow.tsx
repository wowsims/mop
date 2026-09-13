import type { SeparatorRow } from '../../../model/timeline/rotation';
import { rowStyle } from './utils';

export interface RotationSeparatorRowProps {
	row: SeparatorRow;
}

export const RotationSeparatorRow = ({ row }: RotationSeparatorRowProps) => (
	<div className="ui-timeline-row rotation-row rotation-row-separator border-b-white" style={rowStyle(row)} data-row-key={row.key}>
		<div className="ui-timeline-label-col rotation-row-label" />
		<div className="ui-timeline-row-track rotation-row-track" />
	</div>
);
