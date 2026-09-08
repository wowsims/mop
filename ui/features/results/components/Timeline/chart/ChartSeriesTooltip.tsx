import type { CombatLog, DpsLog, ResourceGroupLog, ThreatLogGroup } from '@sim/proto/combat_log';

import type { TooltipSpec } from '../../../view/timeline/chart/types';
import { ResourceTooltip } from '../tooltips/ResourceTooltip';
import { DpsTooltip } from './DpsTooltip';
import { ThreatTooltip } from './ThreatTooltip';

export interface ChartSeriesTooltipProps {
	spec: TooltipSpec;
	log: CombatLog;
}

/** The tooltip a chart series shows, picked from the series' own descriptor. One entry per kind. */
export const ChartSeriesTooltip = ({ spec, log }: ChartSeriesTooltipProps) => {
	switch (spec.kind) {
		case 'dps':
			return <DpsTooltip log={log as DpsLog} />;
		case 'threat':
			return <ThreatTooltip log={log as ThreatLogGroup} />;
		case 'resource':
			return <ResourceTooltip log={log as ResourceGroupLog} maxValue={spec.maxValue} includeAuras={spec.includeAuras} />;
	}
};
