import type { StatWeightsResult, StatWeightValues } from '@generated/proto/api';
import type { Stat } from '@generated/proto/common';
import type { DisplayMetrics } from '@sim/hooks/useDisplayMetrics';
import type { Player } from '@sim/player/player';
import { scaledEpValue, type Stats, type UnitStat } from '@sim/proto/stats';
import type { StatWeightActionSettings } from '@sim/settings/stat_weight_settings';
import { sanitizeId } from '@sim/utils/format';
import { BooleanPicker } from '@ui-kit/BooleanPicker';
import { NumberPicker } from '@ui-kit/NumberPicker';
import clsx from 'clsx';

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
	showThreatMetrics: boolean;
	displayMetrics: DisplayMetrics;
}

export const StatWeightRow = ({
	stat,
	result,
	iterations,
	epRatios,
	epWeights,
	settings,
	player,
	epReferenceStat,
	includable,
	isTank,
	showThreatMetrics,
	displayMetrics,
}: StatWeightRowProps) => {
	const rowResult = settings.isUnitStatExcludedFromCalc(stat) ? null : result;
	const epDelta = scaledEpValue(stat, epRatios, rowResult) - epWeights.getUnitStat(stat);
	const fullName = stat.getFullName(player.getClass());
	const cellClassName = clsx('ui-ep-weights-table-cell', showThreatMetrics && 'max-lg:pl-0');
	const allMetrics: { statWeights: StatWeightValues | undefined; metric: keyof DisplayMetrics }[] = [
		{ statWeights: rowResult?.dps, metric: 'damage' },
		{ statWeights: rowResult?.hps, metric: 'healing' },
		{ statWeights: rowResult?.tps, metric: 'threat' },
		{ statWeights: rowResult?.dtps, metric: 'threat' },
		{ statWeights: rowResult?.tmi, metric: 'threat' },
		{ statWeights: rowResult?.pDeath, metric: 'threat' },
	];
	const metrics = allMetrics.map((entry, ratioIndex) => ({ ...entry, ratioIndex })).filter(entry => displayMetrics[entry.metric]);

	return (
		<tr className="odd:bg-(--table-row-odd-bg) even:bg-(--table-row-even-bg)">
			<td className={cellClassName}>{fullName}</td>
			{!isTank && (
				<td data-testid="swcalc-include-toggle" className={cellClassName}>
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
				metrics.map(({ statWeights, ratioIndex }) => (
					<StatWeightCells
						key={ratioIndex}
						stat={stat}
						statWeights={statWeights}
						iterations={iterations}
						epRatio={epRatios[ratioIndex]}
						epDelta={epDelta}
						cellClassName={cellClassName}
					/>
				))}
			<td data-testid="current-ep" className={cellClassName}>
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
					inputClassName={showThreatMetrics ? 'ui-ep-weights-compact-input' : undefined}
				/>
			</td>
		</tr>
	);
};
