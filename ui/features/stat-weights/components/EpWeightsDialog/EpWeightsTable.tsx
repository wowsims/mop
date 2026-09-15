import type { StatWeightsResult } from '@generated/proto/api';
import type { Stat } from '@generated/proto/common';
import type { DisplayMetrics } from '@sim/hooks/useDisplayMetrics';
import type { Player } from '@sim/player/player';
import type { Stats, UnitStat } from '@sim/proto/stats';
import type { StatWeightActionSettings } from '@sim/settings/stat_weight_settings';
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
	isTank: boolean;
	showThreatMetrics: boolean;
	showEpRatios: boolean;
	displayMetrics: DisplayMetrics;
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
	isTank,
	showThreatMetrics,
	showEpRatios,
	displayMetrics,
}: EpWeightsTableProps) => (
	<div data-testid="results-ep-table-container" className="relative flex-1 overflow-y-auto">
		<table
			data-testid="results-ep-table"
			className={clsx('w-full', showThreatMetrics && 'max-lg:pr-0', `stats-type-${statsType}`)}
			data-stats-type={statsType}>
			<thead>
				<EpWeightsHeader columns={columns} isTank={isTank} showThreatMetrics={showThreatMetrics} />
				{!isTank && showEpRatios && <EpRatiosRow columns={columns} player={player} onComputeEp={onComputeEp} showThreatMetrics={showThreatMetrics} />}
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
						isTank={isTank}
						showThreatMetrics={showThreatMetrics}
						displayMetrics={displayMetrics}
					/>
				))}
			</tbody>
		</table>
	</div>
);
