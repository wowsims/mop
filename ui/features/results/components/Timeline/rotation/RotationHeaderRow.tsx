import type { HeaderRow } from '../../../model/timeline/rotation';
import { RotationRowIcon } from './RotationRowIcon';
import { RotationRowLabel } from './RotationRowLabel';
import { rowStyle } from './utils';

export interface RotationHeaderRowProps {
	row: HeaderRow;
}

export const RotationHeaderRow = ({ row }: RotationHeaderRowProps) => (
	<div className="rotation-row rotation-row-header" style={rowStyle(row)} data-row-key={row.key}>
		<RotationRowLabel text={row.label} icon={row.actionId && <RotationRowIcon actionId={row.actionId} />} />
		<div className="rotation-row-track" />
	</div>
);
