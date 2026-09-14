import type { SeparatorRow } from '../../../model/timeline/rotation';
import { rowStyle } from './utils';

export interface RotationSeparatorRowProps {
	row: SeparatorRow;
}

export const RotationSeparatorRow = ({ row }: RotationSeparatorRowProps) => (
	<div data-testid="rotation-row" data-row-kind={row.kind} className="ui-timeline-row border-b-white" style={rowStyle(row)} data-row-key={row.key}>
		<div className="ui-timeline-label-col" />
		<div data-testid="rotation-row-track" className="ui-timeline-row-track" />
	</div>
);
