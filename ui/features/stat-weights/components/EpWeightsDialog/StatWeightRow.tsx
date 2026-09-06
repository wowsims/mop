import { sanitizeId } from '@domain/format';
import type { Player } from '@domain/player';
import { scaledEpValue, type Stats, type UnitStat } from '@domain/proto_utils/stats';
import type { StatWeightActionSettings } from '@domain/stat_weight_settings';
import { subscribePlayerField, subscribeStatWeightsChange } from '@domain/state/subscriptions';
import type { StatWeightsResult } from '@generated/proto/api';
import type { Stat } from '@generated/proto/common';
import { BooleanPicker } from '@ui-kit/BooleanPicker';
import { NumberPicker } from '@ui-kit/NumberPicker';

import { StatWeightCells } from './StatWeightCells';

export interface StatWeightRowProps {
	stat: UnitStat;
	result: StatWeightsResult | null;
	iterations: number;
	epRatios: number[];
	epWeights: Stats;
	settings: StatWeightActionSettings;
	player: Player<any>;
	epReferenceStat: Stat;
	includable: boolean;
}

export const StatWeightRow = ({ stat, result, iterations, epRatios, epWeights, settings, player, epReferenceStat, includable }: StatWeightRowProps) => {
	const rowResult = settings.isUnitStatExcludedFromCalc(stat) ? null : result;
	const epDelta = scaledEpValue(stat, epRatios, rowResult) - epWeights.getUnitStat(stat);
	const fullName = stat.getFullName(player.getClass());
	const metrics = [
		{ statWeights: rowResult?.dps, metricClass: 'damage-metrics' },
		{ statWeights: rowResult?.hps, metricClass: 'healing-metrics' },
		{ statWeights: rowResult?.tps, metricClass: 'threat-metrics' },
		{ statWeights: rowResult?.dtps, metricClass: 'threat-metrics' },
		{ statWeights: rowResult?.tmi, metricClass: 'threat-metrics' },
		{ statWeights: rowResult?.pDeath, metricClass: 'threat-metrics' },
	];

	return (
		<tr>
			<td>{fullName}</td>
			<td className="swcalc-include-toggle">
				{includable && (
					<BooleanPicker
						modObject={settings}
						config={{
							id: `sw-stat-toggle-${sanitizeId(fullName)}`,
							getValue: () => !settings.isUnitStatExcludedFromCalc(stat),
							setValue: (subject, newValue) => subject.setStatExcluded(stat, !newValue),
							storeSubscribe: subject => subscribeStatWeightsChange(subject),
							enableWhen: () => !stat.isStat() || epReferenceStat !== stat.getStat(),
						}}
					/>
				)}
			</td>
			{metrics.map(({ statWeights, metricClass }, index) => (
				<StatWeightCells
					key={index}
					stat={stat}
					statWeights={statWeights}
					metricClass={metricClass}
					iterations={iterations}
					epRatio={epRatios[index]}
					epDelta={epDelta}
				/>
			))}
			<td className="current-ep">
				<NumberPicker
					modObject={player}
					config={{
						id: `ep-weight-stat-${sanitizeId(stat.getShortName(player.playerClass.classID))}`,
						float: true,
						storeSubscribe: subject => subscribePlayerField(subject, 'epWeights'),
						getValue: subject => subject.getEpWeights().getUnitStat(stat),
						setValue: (subject, newValue) => subject.setEpWeights(subject.getEpWeights().withUnitStat(stat, newValue)),
					}}
				/>
			</td>
		</tr>
	);
};
