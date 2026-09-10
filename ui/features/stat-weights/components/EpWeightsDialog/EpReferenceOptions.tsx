import { usePlayer } from '@sim/context/SimHostContext';
import type { ResultMetricCategories } from '@features/results/model/sim_results';
import { metricsClassName } from '@features/results/model/sim_results';
import clsx from 'clsx';
import type { Player } from '@sim/player/player';
import { subscribePlayerField } from '@sim/state/subscriptions';
import { Stat } from '@generated/proto/common';
import i18n from '@i18n/config';
import { EnumPicker } from '@ui-kit/EnumPicker';
import { useMemo } from 'react';

import { statName } from './utils';

export interface EpReferenceOptionsProps {
	epStats: Stat[];
	epReferenceStat: Stat;
}

type Reference = {
	id: string;
	metric: keyof ResultMetricCategories;
	label: string;
	getValue: (player: Player<any>) => Stat;
	setValue: (player: Player<any>, value: Stat) => void;
};

export const EpReferenceOptions = ({ epStats, epReferenceStat }: EpReferenceOptionsProps) => {
	const player = usePlayer();

	const references = useMemo(
		(): Reference[] => [
			{
				id: 'ep-ref-stat-damage',
				metric: 'damage',
				label: i18n.t('sidebar.buttons.stat_weights.modal.dps_tps_reference'),
				getValue: subject => subject.getRefStat('dpsRefStat') ?? epReferenceStat,
				setValue: (subject, value) => subject.setRefStat('dpsRefStat', value),
			},
			{
				id: 'ep-ref-stat-healing',
				metric: 'healing',
				label: i18n.t('sidebar.buttons.stat_weights.modal.healing_reference'),
				getValue: subject => subject.getRefStat('healRefStat') ?? epReferenceStat,
				setValue: (subject, value) => subject.setRefStat('healRefStat', value),
			},
			{
				id: 'ep-ref-stat-threat',
				metric: 'threat',
				label: i18n.t('sidebar.buttons.stat_weights.modal.mitigation_reference'),
				getValue: subject => subject.getRefStat('tankRefStat') ?? Stat.StatArmor,
				setValue: (subject, value) => subject.setRefStat('tankRefStat', value),
			},
		],
		[epReferenceStat],
	);

	const values = useMemo(() => epStats.map(stat => ({ name: statName(stat), value: stat })), [epStats]);

	return (
		<div className="ep-reference-options row">
			{references.map(reference => (
				<div key={reference.id} className={clsx('col col-sm-4', metricsClassName(reference.metric))}>
					<EnumPicker
						modObject={player}
						config={{
							id: reference.id,
							label: reference.label,
							extraCssClasses: ['ref-stat-select', metricsClassName(reference.metric)],
							values,
							storeSubscribe: subject => subscribePlayerField(subject, 'epRefStat'),
							getValue: reference.getValue,
							setValue: reference.setValue,
						}}
					/>
				</div>
			))}
			<p>{i18n.t('sidebar.buttons.stat_weights.modal.reference_description')}</p>
		</div>
	);
};
