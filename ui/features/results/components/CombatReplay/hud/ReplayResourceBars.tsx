import type { ReplayResourceRow } from '../../../model/replay';
import { ReplayResourceBar } from './ReplayResourceBar';
import { ReplayResourcePips } from './ReplayResourcePips';

export interface ReplayResourceBarsProps {
	rows: ReadonlyArray<ReplayResourceRow>;
}

/**
 * One row per resource the log ever reported, built once: the set never changes mid-fight, so a row
 * appearing or disappearing can never make the HUD jump in height.
 */
export const ReplayResourceBars = ({ rows }: ReplayResourceBarsProps) => (
	<div className="cr-resource-bars">
		{rows.map(row => (row.segmented ? <ReplayResourcePips key={row.type} row={row} /> : <ReplayResourceBar key={row.type} row={row} />))}
	</div>
);
