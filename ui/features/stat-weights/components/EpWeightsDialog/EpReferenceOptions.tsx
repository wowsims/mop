import { Stat } from '@generated/proto/common';
import i18n from '@i18n/config';
import { usePlayer } from '@sim/context/SimHostContext';
import type { DisplayMetrics } from '@sim/hooks/useDisplayMetrics';
import type { Player } from '@sim/player/player';
import { EnumPicker } from '@ui-kit/EnumPicker';
import { useMemo } from 'react';

import { statName } from './utils';

export interface EpReferenceOptionsProps {
	epStats: Stat[];
	epReferenceStat: Stat;
	displayMetrics: DisplayMetrics;
}

type Reference = {
	id: string;
	metric: keyof DisplayMetrics;
	label: string;
	getValue: (player: Player<any>) => Stat;
	setValue: (player: Player<any>, value: Stat) => void;
};

export const EpReferenceOptions = ({ epStats, epReferenceStat, displayMetrics }: EpReferenceOptionsProps) => {
	const player = usePlayer();

	const references = useMemo(() => {
		const all: Reference[] = [
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
		];
		return all.filter(reference => displayMetrics[reference.metric]);
	}, [epReferenceStat, displayMetrics]);

	const values = useMemo(() => epStats.map(stat => ({ name: statName(stat), value: stat })), [epStats]);

	return (
		<div data-testid="ep-reference-options" className="-mx-3 mb-3 flex flex-wrap [&_.ui-field-label]:font-bold">
			{references.map(reference => (
				<div key={reference.id} className="w-full px-3 sm:w-1/3">
					<EnumPicker
						modObject={player}
						config={{
							id: reference.id,
							label: reference.label,
							values,
							storeField: 'epRefStat',
							getValue: reference.getValue,
							setValue: reference.setValue,
						}}
						testId="ref-stat-select"
					/>
				</div>
			))}
			<p className="mt-3">{i18n.t('sidebar.buttons.stat_weights.modal.reference_description')}</p>
		</div>
	);
};
