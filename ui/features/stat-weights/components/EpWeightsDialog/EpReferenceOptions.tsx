import { subscribePlayerField } from '@domain/state/subscriptions';
import type { IndividualSimHost } from '@features/sim_host';
import { useSimHost } from '@features/SimHostContext';
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
	metric: string;
	label: string;
	getValue: (host: IndividualSimHost<any>) => Stat;
	setValue: (host: IndividualSimHost<any>, value: Stat) => void;
};

export const EpReferenceOptions = ({ epStats, epReferenceStat }: EpReferenceOptionsProps) => {
	const host = useSimHost();

	const references = useMemo(
		(): Reference[] => [
			{
				id: 'ep-ref-stat-damage',
				metric: 'damage',
				label: i18n.t('sidebar.buttons.stat_weights.modal.dps_tps_reference'),
				getValue: subject => subject.dpsRefStat ?? epReferenceStat,
				setValue: (subject, value) => (subject.dpsRefStat = value),
			},
			{
				id: 'ep-ref-stat-healing',
				metric: 'healing',
				label: i18n.t('sidebar.buttons.stat_weights.modal.healing_reference'),
				getValue: subject => subject.healRefStat ?? epReferenceStat,
				setValue: (subject, value) => (subject.healRefStat = value),
			},
			{
				id: 'ep-ref-stat-threat',
				metric: 'threat',
				label: i18n.t('sidebar.buttons.stat_weights.modal.mitigation_reference'),
				getValue: subject => subject.tankRefStat ?? Stat.StatArmor,
				setValue: (subject, value) => (subject.tankRefStat = value),
			},
		],
		[epReferenceStat],
	);

	const values = useMemo(() => epStats.map(stat => ({ name: statName(stat), value: stat })), [epStats]);

	return (
		<div className="ep-reference-options row">
			{references.map(reference => (
				<div key={reference.id} className={`col col-sm-4 ${reference.metric}-metrics`}>
					<EnumPicker
						modObject={host}
						config={{
							id: reference.id,
							label: reference.label,
							extraCssClasses: ['ref-stat-select', `${reference.metric}-metrics`],
							values,
							storeSubscribe: subject => subscribePlayerField(subject.player, 'epRefStat'),
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
