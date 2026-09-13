import { Target as TargetProto } from '@generated/proto/common';
import i18n from '@i18n/config';
import { Encounter } from '@sim/raid/encounter';
import { subscribeEncounterField } from '@sim/state/subscriptions';
import type { ListPickerConfig } from '@ui-kit/ListPicker';
import { ListPicker } from '@ui-kit/ListPicker';
import { useMemo } from 'react';

import { trackEvent } from '../../../../tracking/analytics';
import { TargetPicker } from './TargetPicker';

export interface TargetsPickerProps {
	encounter: Encounter;
}

/** The advanced modal's list of encounter targets. `minimumItems: 1` — an encounter needs one. */
export const TargetsPicker = ({ encounter }: TargetsPickerProps) => {
	const config = useMemo(
		(): ListPickerConfig<Encounter, TargetProto> => ({
			extraClassNames: ['targets-picker', 'mb-0'],
			itemLabel: i18n.t('settings_tab.encounter.target'),
			storeSubscribe: (subject: Encounter) => subscribeEncounterField(subject, 'targets'),
			getValue: (subject: Encounter) => subject.getTargets().slice(),
			setValue: (subject: Encounter, newValue: Array<TargetProto>) => {
				trackEvent({
					action: 'settings',
					category: 'encounter',
					label: newValue.length > subject.getTargets().length ? 'add-target' : 'remove-target',
				});
				subject.setTargets(newValue);
			},
			newItem: () => Encounter.defaultTargetProto(),
			copyItem: (oldItem: TargetProto) => TargetProto.clone(oldItem),
			minimumItems: 1,
		}),
		// Every callback takes the encounter as its subject, so the config closes over nothing.
		[],
	);

	return (
		<ListPicker<Encounter, TargetProto>
			modObject={encounter}
			config={config}
			renderItem={targetIndex => <TargetPicker encounter={encounter} targetIndex={targetIndex} />}
		/>
	);
};
