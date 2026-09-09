import type { SeparatorRow } from '../../../model/timeline/rotation';
import { rowStyle } from './utils';

export interface RotationSeparatorRowProps {
	row: SeparatorRow;
}

export const RotationSeparatorRow = ({ row }: RotationSeparatorRowProps) => (
	<div className="rotation-row rotation-row-separator" style={rowStyle(row)} data-row-key={row.key}>
		<div className="rotation-row-label" />
		<div className="rotation-row-track" />
	</div>
);
