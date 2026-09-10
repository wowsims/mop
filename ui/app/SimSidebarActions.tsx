import { SimulateAction } from '@features/results/components/SimulateAction';
import { StatWeightsAction } from '@features/stat-weights/components/StatWeightsAction';
import { SidebarDisabledContext } from '@ui-kit/SidebarActionButton';

import type { SimHostObject } from './individual_sim_ui';
import { NoticeNativeSim } from './NoticeNativeSim';
import { SidebarActions } from './SidebarActions';

export interface SimSidebarActionsProps {
	host: SimHostObject<any>;
}

// This order is observable, not incidental: `SidebarRegistry` sorts stably, so the spec's entries land
// between these exactly where the vanilla shell appended them.
export const SimSidebarActions = ({ host }: SimSidebarActionsProps) => (
	<SidebarDisabledContext value={host.disabled}>
		<SimulateAction />
		<SidebarActions registry={host.sidebar} />
		<StatWeightsAction />
		<NoticeNativeSim container={host.simActionsContainer} />
	</SidebarDisabledContext>
);
