import { sanitizeId } from '@sim/utils/format';
import type { Player } from '@sim/player/player';
import { scaledEpValue, type Stats, type UnitStat } from '@sim/proto/stats';
import type { StatWeightActionSettings } from '@sim/settings/stat_weight_settings';
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
	isTank: boolean;
}

export const StatWeightRow = ({ stat, result, iterations, epRatios, epWeights, settings, player, epReferenceStat, includable, isTank }: StatWeightRowProps) => {
	const rowResult = settings.isUnitStatExcludedFromCalc(stat) ? null : result;
	const epDelta = scaledEpValue(stat, epRatios, rowResult) - epWeights.getUnitStat(stat);
	const fullName = stat.getFullName(player.getClass());
	const cellClassName = 'ui-ep-weights-compact-table-cell';
	const metrics = [
		{ statWeights: rowResult?.dps, metricClass: 'damage-metrics' },
		{ statWeights: rowResult?.hps, metricClass: 'healing-metrics' },
		{ statWeights: rowResult?.tps, metricClass: 'threat-metrics' },
		{ statWeights: rowResult?.dtps, metricClass: 'threat-metrics' },
		{ statWeights: rowResult?.tmi, metricClass: 'threat-metrics' },
		{ statWeights: rowResult?.pDeath, metricClass: 'threat-metrics' },
	];

	return (
		<tr className="odd:bg-(--table-row-odd-bg) even:bg-(--table-row-even-bg)">
			<td className={cellClassName}>{fullName}</td>
			{!isTank && (
				<td className={`swcalc-include-toggle ${cellClassName}`}>
					{includable && (
						<BooleanPicker
							modObject={settings}
							config={{
								id: `sw-stat-toggle-${sanitizeId(fullName)}`,
								getValue: () => !settings.isUnitStatExcludedFromCalc(stat),
								setValue: (subject, newValue) => subject.setStatExcluded(stat, !newValue),
								storeField: 'statWeights:settings',
								enableWhen: () => !stat.isStat() || epReferenceStat !== stat.getStat(),
								extraClassNames: ['mb-0'],
							}}
						/>
					)}
				</td>
			)}
			{!isTank &&
				metrics.map(({ statWeights, metricClass }, index) => (
					<StatWeightCells
						key={index}
						stat={stat}
						statWeights={statWeights}
						metricClass={metricClass}
						iterations={iterations}
						epRatio={epRatios[index]}
						epDelta={epDelta}
						cellClassName={cellClassName}
					/>
				))}
			<td className={`current-ep ${cellClassName}`}>
				<NumberPicker
					modObject={player}
					config={{
						id: `ep-weight-stat-${sanitizeId(stat.getShortName(player.playerClass.classID))}`,
						float: true,
						storeField: 'epWeights',
						getValue: subject => subject.getEpWeights().getUnitStat(stat),
						setValue: (subject, newValue) => subject.setEpWeights(subject.getEpWeights().withUnitStat(stat, newValue)),
						extraClassNames: ['mb-0'],
					}}
					inputClassName="ui-ep-weights-compact-input"
				/>
			</td>
		</tr>
	);
};
