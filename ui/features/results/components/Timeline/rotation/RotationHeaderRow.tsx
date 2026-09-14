import type { HeaderRow } from '../../../model/timeline/rotation';
import { RotationRowIcon } from './RotationRowIcon';
import { RotationRowLabel } from './RotationRowLabel';
import { rowStyle } from './utils';

export interface RotationHeaderRowProps {
	row: HeaderRow;
}

export const RotationHeaderRow = ({ row }: RotationHeaderRowProps) => (
	<div data-testid="rotation-row" data-row-kind={row.kind} className="ui-timeline-row" style={rowStyle(row)} data-row-key={row.key}>
		<RotationRowLabel text={row.label} icon={row.actionId && <RotationRowIcon actionId={row.actionId} />} header />
		<div data-testid="rotation-row-track" className="ui-timeline-row-track" />
	</div>
);
