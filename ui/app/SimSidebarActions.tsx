import { SimulateAction } from '@features/results/components/SimulateAction';
import { StatWeightsAction } from '@features/stat-weights/components/StatWeightsAction';
import { SidebarDisabledContext } from '@ui-kit/SidebarActionButton';

import type { SimHostObject } from './individual_sim_ui';
import { NoticeNativeSim } from './NoticeNativeSim';
import { SidebarActions } from './SidebarActions';

export interface SimSidebarActionsProps {
	host: SimHostObject<any>;
}

// The sim's own two actions bracket the spec's, which is the order they were appended in.
export const SimSidebarActions = ({ host }: SimSidebarActionsProps) => (
	<SidebarDisabledContext value={host.disabled}>
		<SimulateAction />
		<SidebarActions registry={host.sidebar} />
		<StatWeightsAction />
		<NoticeNativeSim container={host.simActionsContainer} />
	</SidebarDisabledContext>
);
