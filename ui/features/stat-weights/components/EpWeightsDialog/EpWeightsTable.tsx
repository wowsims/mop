import type { Player } from '@sim/player/player';
import type { Stats, UnitStat } from '@sim/proto/stats';
import type { StatWeightActionSettings } from '@sim/settings/stat_weight_settings';
import type { StatWeightsResult } from '@generated/proto/api';
import type { Stat } from '@generated/proto/common';
import clsx from 'clsx';

import type { EpStatSet } from '../../model/ep_unit_stats';
import { isEpStat } from '../../model/ep_unit_stats';
import { EpRatiosRow } from './EpRatiosRow';
import { EpWeightsHeader } from './EpWeightsHeader';
import { StatWeightRow } from './StatWeightRow';
import type { EpColumn, StatsType } from './types';

export interface EpWeightsTableProps {
	columns: EpColumn[];
	stats: UnitStat[];
	statsType: StatsType;
	result: StatWeightsResult | null;
	iterations: number;
	epRatios: number[];
	epWeights: Stats;
	settings: StatWeightActionSettings;
	player: Player<any>;
	epStatSet: EpStatSet;
	epReferenceStat: Stat;
	onComputeEp: () => void;
	showThreatMetrics: boolean;
	isTank: boolean;
}

export const EpWeightsTable = ({
	columns,
	stats,
	statsType,
	result,
	iterations,
	epRatios,
	epWeights,
	settings,
	player,
	epStatSet,
	epReferenceStat,
	onComputeEp,
	showThreatMetrics,
	isTank,
}: EpWeightsTableProps) => (
	<div className="relative flex-1 overflow-y-auto">
		<table className={clsx('results-ep-table w-full', `stats-type-${statsType}`, showThreatMetrics && 'max-lg:pr-0')} data-stats-type={statsType}>
			<thead>
				<EpWeightsHeader columns={columns} showThreatMetrics={showThreatMetrics} isTank={isTank} />
				{!isTank && <EpRatiosRow columns={columns} player={player} onComputeEp={onComputeEp} showThreatMetrics={showThreatMetrics} />}
			</thead>
			<tbody>
				{stats.map(stat => (
					<StatWeightRow
						key={stat.getFullName(player.getClass())}
						stat={stat}
						result={result}
						iterations={iterations}
						epRatios={epRatios}
						epWeights={epWeights}
						settings={settings}
						player={player}
						epReferenceStat={epReferenceStat}
						includable={isEpStat(stat, epStatSet)}
						showThreatMetrics={showThreatMetrics}
						isTank={isTank}
					/>
				))}
			</tbody>
		</table>
	</div>
);
