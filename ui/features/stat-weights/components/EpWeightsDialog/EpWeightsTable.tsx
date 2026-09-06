import type { Player } from '@domain/player';
import type { Stats, UnitStat } from '@domain/proto_utils/stats';
import type { StatWeightActionSettings } from '@domain/stat_weight_settings';
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
}: EpWeightsTableProps) => (
	<div className="results-ep-table-container">
		<table className={clsx('results-ep-table', `stats-type-${statsType}`)}>
			<thead>
				<EpWeightsHeader columns={columns} />
				<EpRatiosRow columns={columns} player={player} onComputeEp={onComputeEp} />
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
					/>
				))}
			</tbody>
		</table>
	</div>
);
