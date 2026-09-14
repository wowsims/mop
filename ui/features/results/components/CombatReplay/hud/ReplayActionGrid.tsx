import type { ReplayAction } from '../../../model/replay';
import { ReplayActionIcon } from './ReplayActionIcon';

export interface ReplayActionGridProps {
	/** Every cast, which is what an icon checks itself against. */
	actions: ReadonlyArray<ReplayAction>;
	/** One entry per distinct action — the grid itself. */
	uniqueActions: ReadonlyArray<ReplayAction>;
}

export const ReplayActionGrid = ({ actions, uniqueActions }: ReplayActionGridProps) => (
	<div className="mt-[2px] flex flex-wrap gap-[4px]">
		{uniqueActions.map(action => (
			<ReplayActionIcon key={action.name} action={action} actions={actions} />
		))}
	</div>
);
