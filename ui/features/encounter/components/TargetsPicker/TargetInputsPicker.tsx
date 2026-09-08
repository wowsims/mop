import { TargetInput } from '@generated/proto/common';
import i18n from '@i18n/config';
import type { Encounter } from '@sim/raid/encounter';
import { subscribeEncounterField } from '@sim/state/subscriptions';
import type { ListPickerConfig } from '@ui-kit/ListPicker';
import { ListPicker } from '@ui-kit/ListPicker';
import { useMemo } from 'react';

import { trackEvent } from '../../../../tracking/analytics';
import { TargetInputPicker } from './TargetInputPicker';

export interface TargetInputsPickerProps {
	encounter: Encounter;
	targetIndex: number;
}

/** The AI's own inputs for one target. Read-only as a list: `allowedActions: []` was vanilla's. */
export const TargetInputsPicker = ({ encounter, targetIndex }: TargetInputsPickerProps) => {
	const config = useMemo(
		(): ListPickerConfig<Encounter, TargetInput> => ({
			allowedActions: [],
			itemLabel: i18n.t('settings_tab.encounter.target_inputs.label'),
			extraCssClasses: ['mt-2'],
			isCompact: true,
			storeSubscribe: (subject: Encounter) => subscribeEncounterField(subject, 'targets'),
			getValue: (subject: Encounter) => subject.getTargets()[targetIndex].targetInputs.slice(),
			setValue: (subject: Encounter, newValue: Array<TargetInput>) => {
				trackEvent({ action: 'settings', category: 'targets', label: 'count', value: newValue.length });
				subject.modifyTarget(targetIndex, target => {
					target.targetInputs = newValue;
				});
			},
			newItem: () => TargetInput.create(),
			copyItem: (oldItem: TargetInput) => TargetInput.clone(oldItem),
		}),
		// Every callback takes the encounter as its subject, so only the index is closed over.
		[targetIndex],
	);

	return (
		<ListPicker<Encounter, TargetInput>
			modObject={encounter}
			config={config}
			renderItem={(inputIndex, itemConfig) => (
				<TargetInputPicker encounter={encounter} targetIndex={targetIndex} inputIndex={inputIndex} input={itemConfig.getValue(encounter)} />
			)}
		/>
	);
};
